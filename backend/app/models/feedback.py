"""User feedback board — a Kanban-style bug/improvement tracker open to every
signed-in account (no permission-matrix gating; this isn't a module like
Employees/Onboarding/Attendance/Awards, it's a shared inbox anyone can drop a
report into). Only a Super Admin can move a card between status columns, set
its priority, or see who submitted it — everyone else sees the card
anonymized (no reporter identity at all, not even to the person who filed
it) via FeedbackRead's reported_by fields being nulled out server-side for
non-Super-Admin requests (see app/api/routes/feedback.py).

FeedbackComment (below) is the reply thread on one card — a small chat, not
a public comment section: only the original reporter and a Super Admin may
ever read or post to a given card's thread (enforced in
app/api/routes/feedback.py's _can_access_thread, not here). Everyone
else doesn't even know the thread exists.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.account import AccountRole

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

    # Screenshots attached at report time — a list of data: URLs, same
    # inline-storage tradeoff as FeedbackComment.image_data below (no object
    # storage wired up in this app), just plural since a bug report often
    # benefits from more than one screenshot. Capped in count and per-image
    # size at the route level (MAX_SCREENSHOTS / MAX_IMAGE_DATA_URL_LENGTH in
    # app/api/routes/feedback.py), not here.
    screenshot_urls: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    reported_by: Mapped["Account | None"] = relationship()


class FeedbackComment(Base):
    __tablename__ = "feedback_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    feedback_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Nullable + SET NULL, same reasoning as Feedback.reported_by_id — a
    # message in the thread outlives its author's account being deleted.
    # author_label/author_role are snapshotted at post time (same pattern as
    # ActivityLog.actor_label) so an old message still reads correctly even
    # if the person is later renamed or their role changes.
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), index=True
    )
    author_label: Mapped[str] = mapped_column(String(200), nullable=False)
    author_role: Mapped[AccountRole] = mapped_column(
        Enum(AccountRole, name="account_role", create_type=False),
        nullable=False,
    )

    # At least one of these two is always set (enforced in the route, not a
    # DB constraint) — a message can be text-only, image-only, or both.
    message: Mapped[str | None] = mapped_column(Text)
    # A data: URL (base64-encoded) — this app has no object-storage service
    # wired up yet, so an attached screenshot is stored inline rather than
    # adding a new external dependency for what's meant to be an occasional
    # "proof" attachment, not a general file-upload feature. Capped
    # client- and server-side (see MAX_IMAGE_DATA_URL_LENGTH in
    # app/api/routes/feedback.py) so one large paste can't bloat the table.
    image_data: Mapped[str | None] = mapped_column(Text)

    # emoji -> list of account id strings who reacted with it, e.g.
    # {"👍": ["<uuid>", "<uuid>"]}. A JSONB blob rather than a separate
    # reactions table — reaction data is small, always read/written as a
    # whole alongside its comment, and never queried independently of it.
    reactions: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    author: Mapped["Account | None"] = relationship()
