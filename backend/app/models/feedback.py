"""User feedback board — a Kanban-style bug/improvement tracker open to every
signed-in account (no permission-matrix gating; this isn't a module like
Employees/Onboarding/Attendance/Awards, it's a shared inbox anyone can drop a
report into). Only a Super Admin can move a card between status columns, set
its priority, or see who submitted it — everyone else sees the card
anonymized (no reporter identity at all, not even to the person who filed
it) via FeedbackRead's reported_by fields being nulled out server-side for
non-Super-Admin requests (see app/api/routes/feedback.py).
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.account import Account


class FeedbackType(enum.StrEnum):
    BUG = "bug"
    IMPROVEMENT = "improvement"


class FeedbackStatus(enum.StrEnum):
    PENDING = "pending"
    WORKING_ON_IT = "working_on_it"
    RESOLVED = "resolved"
    IMPLEMENTED = "implemented"


class FeedbackPriority(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    type: Mapped[FeedbackType] = mapped_column(
        Enum(FeedbackType, name="feedback_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Every card starts Pending — only a Super Admin ever moves it from here
    # (see require_super_admin on the PATCH route).
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus, name="feedback_status", values_callable=lambda e: [m.value for m in e]),
        default=FeedbackStatus.PENDING,
        server_default=FeedbackStatus.PENDING.value,
        nullable=False,
    )
    priority: Mapped[FeedbackPriority] = mapped_column(
        Enum(FeedbackPriority, name="feedback_priority", values_callable=lambda e: [m.value for m in e]),
        default=FeedbackPriority.MEDIUM,
        server_default=FeedbackPriority.MEDIUM.value,
        nullable=False,
    )

    # Nullable + ON DELETE SET NULL, same reasoning as ActivityLog.account_id
    # — a card outlives the reporting account being deleted. The label is a
    # snapshot for display (Super Admin only); reported_by_id exists mainly
    # so a deleted/deactivated account doesn't silently break anything.
    reported_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), index=True
    )
    reported_by_label: Mapped[str] = mapped_column(String(200), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    reported_by: Mapped["Account | None"] = relationship()
