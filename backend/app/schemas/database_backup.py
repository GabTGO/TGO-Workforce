import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict

from app.models.backup_schedule import BackupFrequency
from app.models.database_backup import BackupStatus, BackupTrigger


class BackupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trigger: BackupTrigger
    status: BackupStatus
    tables: list[str] | None
    file_name: str | None
    file_size_bytes: int | None
    error_message: str | None
    requested_by_label: str | None
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime


class BackupRunRequest(BaseModel):
    # null/omitted = every table.
    tables: list[str] | None = None


class BackupScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    frequency: BackupFrequency
    day_of_week: int | None
    time_of_day: time
    tables: list[str] | None
    last_run_at: datetime | None


class BackupScheduleUpdate(BaseModel):
    enabled: bool | None = None
    frequency: BackupFrequency | None = None
    day_of_week: int | None = None
    time_of_day: time | None = None
    tables: list[str] | None = None
