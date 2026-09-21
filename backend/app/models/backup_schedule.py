"""A single-row table (id=1) holding the Super Admin-configured automatic
backup schedule — "set the time to backup automatically" from the Bulk
Fix-adjacent Database Backups module. Same singleton pattern as
app/models/app_settings.py and app/models/list_options.py; see
app/services/backup_schedule.py for the get-or-create accessor.

Checked once a minute by app/workers/backup_worker.py, which runs in the same
process as the existing violation email send worker (see
app/workers/main.py) rather than its own Railway service — both are cheap
polling loops, so there's no need for a third always-on service just for this.

time_of_day is deliberately UTC, not the viewer's local time or any per-org
timezone setting — this app has no per-account timezone field to convert
against, so the frontend labels the picker "UTC" explicitly instead of
silently being wrong for someone assuming their own zone.
"""

import enum
from datetime import datetime, time

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Integer, SmallInteger, Time
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class BackupFrequency(enum.StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"


class BackupSchedule(Base):
    __tablename__ = "backup_schedule"
    __table_args__ = (CheckConstraint("id = 1", name="backup_schedule_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)

    enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    frequency: Mapped[BackupFrequency] = mapped_column(
        Enum(
            BackupFrequency,
            name="backup_frequency",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=BackupFrequency.DAILY,
        nullable=False,
    )
    # 0=Monday..6=Sunday (Python's date.weekday() convention) — only read
    # when frequency == WEEKLY.
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger)
    time_of_day: Mapped[time] = mapped_column(Time, default=time(2, 0), nullable=False)

    # null = every table; otherwise the specific table names to back up on
    # each scheduled run — same shape as DatabaseBackup.tables.
    tables: Mapped[list[str] | None] = mapped_column(JSONB)

    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
