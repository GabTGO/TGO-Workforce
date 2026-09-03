"""The Activity Log table — the real backing store for the Activity Logs page,
which currently renders a hardcoded sample array in the frontend.

category/severity values match the frontend's existing LogCategory/LogSeverity
types (src/routes/activity-logs.tsx) exactly, so wiring the page up later is a
straight swap from the static array to a fetch of this table.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.account import Account


class ActivityCategory(enum.StrEnum):
    EMPLOYEE = "employee"
    ACCESS = "access"
    DATA = "data"
    SYSTEM = "system"


class ActivitySeverity(enum.StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Nullable + ON DELETE SET NULL: an account can be deleted (or just
    # deactivated) without losing the historical log rows it left behind — the
    # whole point of an audit trail is that it outlives the actor.
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), index=True
    )
    # A snapshot of the actor's display name at the time of the event (or
    # "System" for automated actions with no account at all), so the log entry
    # still reads correctly even after the account is renamed or removed —
    # never rely solely on the live join for display.
    actor_label: Mapped[str] = mapped_column(String(200), nullable=False)

    action: Mapped[str] = mapped_column(String(255), nullable=False)
    target: Mapped[str | None] = mapped_column(String(255))

    # values_callable here too — see the comment on Account.role.
    category: Mapped[ActivityCategory] = mapped_column(
        Enum(
            ActivityCategory,
            name="activity_category",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    severity: Mapped[ActivitySeverity] = mapped_column(
        Enum(
            ActivitySeverity,
            name="activity_severity",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ActivitySeverity.INFO,
        nullable=False,
    )
    # Optional structured detail (e.g. {"before": {...}, "after": {...}} for an
    # edit) — free-form on purpose since different action types need different
    # shapes here.
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    account: Mapped["Account | None"] = relationship(back_populates="activity_logs")
