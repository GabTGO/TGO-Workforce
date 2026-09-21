"""Generates a Postgres SQL dump (via the real `pg_dump` binary, not a
hand-rolled serializer — see app/models/database_backup.py's docstring for
why) and stores it as a DatabaseBackup row, gzip-compressed. Used by both the
manual "Backup Now" API route (app/api/routes/backups.py) and the scheduled
worker loop (app/workers/backup_worker.py) — one implementation, two callers.

Requires the `pg_dump` command to be on PATH. Locally that's whatever
postgresql-client package your OS provides; on Railway, the API service (built
with Railpack) gets it from backend/railpack.json's deploy.aptPackages, and
the worker service (built from backend/Dockerfile.worker directly — see that
file) installs it itself via apt-get. A missing/failing pg_dump
doesn't raise — it's recorded as a FAILED backup row with error_message set,
since GET /backups already surfaces status + error per row and that's a much
better place for a Super Admin to see "why didn't last night's backup work"
than a 500 or a silently-dead worker loop.
"""

import asyncio
import gzip
import logging
import os
from datetime import UTC, datetime
from urllib.parse import urlparse

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.account import Account
from app.models.backup_schedule import BackupFrequency
from app.models.database_backup import BackupStatus, BackupTrigger, DatabaseBackup
from app.services.backup_schedule import get_backup_schedule

logger = logging.getLogger("backup")

# How many completed *scheduled* backups to keep — a manual snapshot is never
# auto-pruned, since someone specifically asked for that one. Bounds how much
# the database_backups table (which stores dump bytes in-row) can grow from a
# daily/weekly schedule running indefinitely.
AUTO_BACKUP_RETENTION = 14


def _pg_dump_command(tables: list[str] | None) -> tuple[list[str], dict[str, str]]:
    settings = get_settings()
    parsed = urlparse(settings.database_url)
    env = {**os.environ, "PGPASSWORD": parsed.password or ""}
    cmd = [
        "pg_dump",
        "--no-owner",
        "--no-privileges",
        "--host",
        parsed.hostname or "localhost",
        "--port",
        str(parsed.port or 5432),
        "--username",
        parsed.username or "postgres",
        "--dbname",
        (parsed.path or "/").lstrip("/"),
    ]
    for table in tables or []:
        cmd += ["--table", table]
    return cmd, env


async def run_backup(
    db: AsyncSession,
    *,
    trigger: BackupTrigger,
    tables: list[str] | None = None,
    account: Account | None = None,
) -> DatabaseBackup:
    started_at = datetime.now(UTC)
    if account is not None:
        label = account.display_name or account.email
    else:
        label = "Scheduled" if trigger == BackupTrigger.SCHEDULED else "System"

    backup = DatabaseBackup(
        trigger=trigger,
        status=BackupStatus.RUNNING,
        tables=tables,
        requested_by_id=account.id if account else None,
        requested_by_label=label,
        started_at=started_at,
    )
    db.add(backup)
    await db.flush()
    await db.commit()

    cmd, env = _pg_dump_command(tables)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                stderr.decode("utf-8", errors="replace").strip()[:2000]
                or "pg_dump exited with an error"
            )
    except FileNotFoundError:
        logger.error("pg_dump is not installed on this server")
        backup.status = BackupStatus.FAILED
        backup.error_message = "pg_dump is not installed on this server."
        backup.completed_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(backup)
        return backup
    except Exception as exc:  # noqa: BLE001 - captured on the row, not re-raised
        logger.exception("Backup failed")
        backup.status = BackupStatus.FAILED
        backup.error_message = str(exc)[:2000]
        backup.completed_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(backup)
        return backup

    timestamp = started_at.strftime("%Y%m%d-%H%M%S")
    scope = "-".join(t.replace(" ", "_") for t in tables) if tables else "full"
    backup.file_name = f"tgo-workforce-backup-{scope}-{timestamp}.sql"
    backup.file_size_bytes = len(stdout)
    backup.file_gzip = gzip.compress(stdout)
    backup.status = BackupStatus.COMPLETED
    backup.completed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(backup)
    logger.info("Backup %s completed (%s bytes)", backup.id, backup.file_size_bytes)

    if trigger == BackupTrigger.SCHEDULED:
        await prune_auto_backups(db)

    return backup


async def prune_auto_backups(db: AsyncSession) -> None:
    result = await db.execute(
        select(DatabaseBackup.id)
        .where(DatabaseBackup.trigger == BackupTrigger.SCHEDULED)
        .where(DatabaseBackup.status == BackupStatus.COMPLETED)
        .order_by(DatabaseBackup.created_at.desc())
        .offset(AUTO_BACKUP_RETENTION)
    )
    stale_ids = [row[0] for row in result.all()]
    if not stale_ids:
        return
    await db.execute(delete(DatabaseBackup).where(DatabaseBackup.id.in_(stale_ids)))
    await db.commit()
    logger.info("Pruned %s old scheduled backup(s)", len(stale_ids))


async def maybe_run_scheduled_backup(db: AsyncSession) -> None:
    """Called every ~60s by app/workers/backup_worker.py. Fires a scheduled
    backup once per configured slot (today's time-of-day for "daily", or
    this week's day+time for "weekly") — tracked via last_run_at so a poll
    tick that lands after the target time, or several ticks in a row, only
    ever triggers one run per slot."""
    schedule = await get_backup_schedule(db)
    if not schedule.enabled:
        return

    now = datetime.now(UTC)
    if schedule.frequency == BackupFrequency.WEEKLY and now.weekday() != (
        schedule.day_of_week or 0
    ):
        return

    due_at = now.replace(
        hour=schedule.time_of_day.hour,
        minute=schedule.time_of_day.minute,
        second=0,
        microsecond=0,
    )
    if now < due_at:
        return
    if schedule.last_run_at is not None and schedule.last_run_at >= due_at:
        return  # already ran for this slot

    schedule.last_run_at = now
    await db.commit()
    await run_backup(db, trigger=BackupTrigger.SCHEDULED, tables=schedule.tables)
