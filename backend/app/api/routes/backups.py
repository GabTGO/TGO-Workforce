"""Database Backups — Super Admin-only module for on-demand or scheduled
Postgres dumps, downloadable as .sql files. See app/services/backup.py for
how a dump is actually produced (a real `pg_dump`, gzip-compressed into a
DatabaseBackup row) and app/workers/backup_worker.py for the scheduled side.

Every route here is Super Admin-only (router-level dependency) — stricter
than every other admin-ish module in this app, which stop at require_admin.
A database dump is a strictly more sensitive artifact than anything else an
Admin can already reach (it's a full copy of every table's data at once,
downloadable in one click), so this deliberately doesn't extend Admin's usual
blanket access.
"""

import gzip
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_super_admin
from app.core.db import Base, get_db
from app.models.account import Account
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.database_backup import BackupStatus, BackupTrigger, DatabaseBackup
from app.schemas.database_backup import (
    BackupRead,
    BackupRunRequest,
    BackupScheduleRead,
    BackupScheduleUpdate,
)
from app.services.activity_log import record_activity
from app.services.backup import run_backup
from app.services.backup_schedule import get_backup_schedule

router = APIRouter(prefix="/backups", tags=["backups"], dependencies=[Depends(require_super_admin)])

DbSession = Annotated[AsyncSession, Depends(get_db)]
SuperAdmin = Annotated[Account, Depends(require_super_admin)]

# How many backup rows the list view returns — plenty for "what's happened
# recently", and prune_auto_backups already keeps the scheduled ones capped
# at AUTO_BACKUP_RETENTION anyway (see app/services/backup.py).
LIST_LIMIT = 200


@router.get("/tables", response_model=list[str])
async def list_backupable_tables() -> list[str]:
    """Every real table in the schema, read live off Base.metadata rather
    than hardcoded — stays correct as models are added/removed with no second
    place to update. Excludes database_backups itself (backing that up into
    itself is pointless busywork, not a real safeguard)."""
    return sorted(name for name in Base.metadata.tables if name != "database_backups")


@router.get("", response_model=list[BackupRead])
async def list_backups(db: DbSession) -> list[DatabaseBackup]:
    result = await db.execute(
        select(DatabaseBackup).order_by(DatabaseBackup.created_at.desc()).limit(LIST_LIMIT)
    )
    return list(result.scalars().all())


@router.post("/run", response_model=BackupRead, status_code=status.HTTP_201_CREATED)
async def run_manual_backup(
    payload: BackupRunRequest, db: DbSession, account: SuperAdmin
) -> DatabaseBackup:
    backup = await run_backup(
        db, trigger=BackupTrigger.MANUAL, tables=payload.tables, account=account
    )
    ok = backup.status == BackupStatus.COMPLETED
    await record_activity(
        db,
        action="Ran a manual database backup" if ok else "Manual database backup failed",
        category=ActivityCategory.SYSTEM,
        account=account,
        severity=ActivitySeverity.INFO if ok else ActivitySeverity.CRITICAL,
        target=backup.file_name or str(backup.id),
        details={"tables": backup.tables, "error": backup.error_message}
        if not ok
        else {"tables": backup.tables},
        commit=True,
    )
    return backup


@router.get("/{backup_id}/download")
async def download_backup(backup_id: uuid.UUID, db: DbSession) -> Response:
    backup = await db.get(DatabaseBackup, backup_id)
    if backup is None or backup.status != BackupStatus.COMPLETED or not backup.file_gzip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found or not ready"
        )
    content = gzip.decompress(backup.file_gzip)
    return Response(
        content=content,
        media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{backup.file_name}"'},
    )


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(backup_id: uuid.UUID, db: DbSession, account: SuperAdmin) -> None:
    backup = await db.get(DatabaseBackup, backup_id)
    if backup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    label = backup.file_name or str(backup.id)
    await db.delete(backup)
    await record_activity(
        db,
        action="Deleted a database backup",
        category=ActivityCategory.SYSTEM,
        account=account,
        severity=ActivitySeverity.WARNING,
        target=label,
        commit=False,
    )
    await db.commit()


@router.get("/schedule", response_model=BackupScheduleRead)
async def get_schedule(db: DbSession) -> BackupScheduleRead:
    schedule = await get_backup_schedule(db)
    await db.commit()  # persists the row if get_backup_schedule just created it
    return BackupScheduleRead.model_validate(schedule)


@router.patch("/schedule", response_model=BackupScheduleRead)
async def update_schedule(
    payload: BackupScheduleUpdate, db: DbSession, account: SuperAdmin
) -> BackupScheduleRead:
    schedule = await get_backup_schedule(db)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(schedule, field, value)

    if changes:
        await record_activity(
            db,
            action="Updated the automatic database backup schedule",
            category=ActivityCategory.SYSTEM,
            account=account,
            severity=ActivitySeverity.INFO,
            details={k: str(v) for k, v in changes.items()},
            commit=False,
        )
    await db.commit()
    await db.refresh(schedule)
    return BackupScheduleRead.model_validate(schedule)
