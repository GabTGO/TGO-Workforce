"""Generates a Postgres SQL dump (via the real `pg_dump` binary, not a
hand-rolled serializer — see app/models/database_backup.py's docstring for
why) and stores it as a DatabaseBackup row, gzip-compressed.

Split into two steps that run in different processes:

  - create_pending_backup(): inserts a RUNNING row and returns immediately.
    Called from the manual "Backup Now" API route
    (app/api/routes/backups.py) — the API service CANNOT run pg_dump itself
    (see below), so this is all it does.
  - execute_backup(): actually shells out to pg_dump and fills in the row.
    Only ever called from the worker service
    (app/workers/backup_worker.py), for both scheduled runs (which call
    create_pending_backup + execute_backup back to back, no queueing
    needed) and manual ones the API queued (picked up within ~60s by
    run_pending_and_scheduled_backups).

Why the split: this database runs Postgres 18
(ghcr.io/railwayapp-templates/postgres-ssl:18), and pg_dump refuses to dump
from a server newer than itself ("aborting because of server version":
Debian's plain `postgresql-client` apt package is v15). Getting a v18
`pg_dump` means adding the official apt.postgresql.org repo, which
Dockerfile.worker (the worker's *actual* build source, not just local dev)
can do; the API service builds with Railpack, whose declarative apt-package
list can only install from the base image's existing sources, with no way to
add a new repo. So the API can never reliably run pg_dump itself — only the
worker can, hence the queue.

A missing/failing pg_dump doesn't raise — it's recorded as a FAILED backup
row with error_message set, since GET /backups already surfaces status +
error per row and that's a much better place for a Super Admin to see "why
didn't last night's backup work" than a dead worker loop.
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
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.backup_schedule import BackupFrequency
from app.models.database_backup import BackupStatus, BackupTrigger, DatabaseBackup
from app.services.activity_log import record_activity
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


async def create_pending_backup(
    db: AsyncSession,
    *,
    trigger: BackupTrigger,
    tables: list[str] | None = None,
    account: Account | None = None,
) -> DatabaseBackup:
    """Inserts a RUNNING row (no dump yet) and returns immediately. See this
    module's docstring for why the API route calling this never runs
    pg_dump directly — app/workers/backup_worker.py's poll loop picks this
    row up (via run_pending_and_scheduled_backups) and calls execute_backup
    on it, usually within about a minute."""
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
        started_at=datetime.now(UTC),
    )
    db.add(backup)
    await db.flush()
    await db.commit()
    await db.refresh(backup)
    return backup


async def execute_backup(db: AsyncSession, backup: DatabaseBackup) -> DatabaseBackup:
    """Actually shells out to pg_dump for an already-created RUNNING row and
    updates it to COMPLETED/FAILED. Worker-only — see this module's
    docstring for why the API service can't call this itself."""
    cmd, env = _pg_dump_command(backup.tables)

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
    except Exception as exc:  # noqa: BLE001 - captured on the row, not re-raised
        logger.exception("Backup failed")
        backup.status = BackupStatus.FAILED
        backup.error_message = str(exc)[:2000]
        backup.completed_at = datetime.now(UTC)
    else:
        timestamp = backup.started_at.strftime("%Y%m%d-%H%M%S")
        scope = "-".join(t.replace(" ", "_") for t in backup.tables) if backup.tables else "full"
        backup.file_name = f"tgo-workforce-backup-{scope}-{timestamp}.sql"
        backup.file_size_bytes = len(stdout)
        backup.file_gzip = gzip.compress(stdout)
        backup.status = BackupStatus.COMPLETED
        backup.completed_at = datetime.now(UTC)
        logger.info("Backup %s completed (%s bytes)", backup.id, backup.file_size_bytes)

    await db.commit()
    await db.refresh(backup)

    ok = backup.status == BackupStatus.COMPLETED
    await record_activity(
        db,
        action="Completed a database backup" if ok else "Database backup failed",
        category=ActivityCategory.SYSTEM,
        actor_label=backup.requested_by_label or "System",
        severity=ActivitySeverity.INFO if ok else ActivitySeverity.CRITICAL,
        target=backup.file_name or str(backup.id),
        details=(
            {"tables": backup.tables}
            if ok
            else {"tables": backup.tables, "error": backup.error_message}
        ),
    )

    if backup.trigger == BackupTrigger.SCHEDULED and ok:
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
    """Fires a scheduled backup once per configured slot (today's
    time-of-day for "daily", or this week's day+time for "weekly") —
    tracked via last_run_at so a poll tick that lands after the target
    time, or several ticks in a row, only ever triggers one run per slot.
    Runs entirely inside the worker, so it calls create_pending_backup and
    execute_backup back to back — no cross-process handoff needed here,
    unlike a manual request from the API."""
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
    backup = await create_pending_backup(
        db, trigger=BackupTrigger.SCHEDULED, tables=schedule.tables
    )
    await execute_backup(db, backup)


async def run_pending_and_scheduled_backups(db: AsyncSession) -> None:
    """Called every ~60s by app/workers/backup_worker.py. First executes any
    manual backup the API queued (create_pending_backup) but hasn't run yet
    — a RUNNING row with no file attached — then checks whether a new
    scheduled run is due."""
    result = await db.execute(
        select(DatabaseBackup)
        .where(DatabaseBackup.status == BackupStatus.RUNNING)
        .where(DatabaseBackup.file_gzip.is_(None))
        .order_by(DatabaseBackup.created_at)
    )
    for backup in result.scalars().all():
        await execute_backup(db, backup)

    await maybe_run_scheduled_backup(db)
