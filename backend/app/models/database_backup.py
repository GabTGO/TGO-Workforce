"""One row per database snapshot — the Super Admin-only "Bulk Fix"-adjacent
module that lets a Super Admin export the whole database (or just specific
tables) as a downloadable .sql dump, on demand or on a schedule (see
app/models/backup_schedule.py for the schedule itself).

The dump is produced by shelling out to `pg_dump` (see app/services/backup.py)
— the real Postgres export tool, not a hand-rolled row-by-row serializer, so
JSONB columns, enums, arrays and constraints all round-trip correctly the way
a plain INSERT-statement dumper couldn't guarantee.

The dump bytes themselves are stored gzip-compressed directly in this table
(file_gzip) rather than on disk or in an external object store — Railway's
filesystem is ephemeral across redeploys and this app doesn't have a Volume
or S3-compatible bucket wired up anywhere else, so this is the zero-new-infra
option. The trade-off is that backups count toward the size of the very
database they're backing up; app/services/backup.py's prune step keeps
automatic (scheduled) backups capped at a fixed count so that stays bounded.
Manual backups are never auto-pruned — a Super Admin who explicitly asked for
one has to explicitly delete it.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class BackupTrigger(enum.StrEnum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"


class BackupStatus(enum.StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class DatabaseBackup(Base):
    __tablename__ = "database_backups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    trigger: Mapped[BackupTrigger] = mapped_column(
        Enum(
            BackupTrigger,
            name="backup_trigger",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    status: Mapped[BackupStatus] = mapped_column(
        Enum(
            BackupStatus,
            name="backup_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=BackupStatus.RUNNING,
        nullable=False,
        index=True,
    )

    # null = every table dumped; otherwise the specific table names that were
    # requested (see GET /backups/tables for the live list this is chosen
    # from — kept in sync with the schema automatically since it's read off
    # Base.metadata rather than hardcoded).
    tables: Mapped[list[str] | None] = mapped_column(JSONB)

    file_name: Mapped[str | None] = mapped_column(String(255))
    # Size of the plain-text .sql dump in bytes, for display — not the same
    # as len(file_gzip), which is compressed.
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    file_gzip: Mapped[bytes | None] = mapped_column(LargeBinary)

    error_message: Mapped[str | None] = mapped_column(String(2000))

    # Nullable + ON DELETE SET NULL, same reasoning as ActivityLog.account_id
    # — a backup row (and its audit value) should outlive the account that
    # requested it. requested_by_label snapshots the display name so the
    # list still reads correctly after that.
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    requested_by_label: Mapped[str | None] = mapped_column(String(200))

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
