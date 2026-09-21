"""Get-or-create accessor for the singleton BackupSchedule row (id=1) — same
reasoning as app/services/app_settings.py's get_app_settings: nothing that
reads or writes the schedule has to worry about the row not existing yet.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.backup_schedule import BackupSchedule

SCHEDULE_ID = 1


async def get_backup_schedule(db: AsyncSession) -> BackupSchedule:
    schedule = await db.get(BackupSchedule, SCHEDULE_ID)
    if schedule is not None:
        return schedule

    schedule = BackupSchedule(id=SCHEDULE_ID)
    db.add(schedule)
    try:
        await db.flush()
    except IntegrityError:
        # Lost a race with another request creating the same singleton row —
        # roll back this attempt and read back whatever won.
        await db.rollback()
        schedule = await db.get(BackupSchedule, SCHEDULE_ID)
        assert schedule is not None
    return schedule
