"""Recognition & Awards — under the Milestones nav group alongside
Anniversaries and Birthdays, but unlike those two (read-only lenses over
Employee data), this is its own real module: someone with Permission.
AWARDS_MANAGE can give a named award to an Active employee, and edit/delete
awards afterward.
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.employee import Employee


class Award(Base):
    __tablename__ = "awards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    employee_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Snapshotted at award-creation time (same reasoning as ActivityLog's
    # actor_label) — an award's history should still read correctly even if
    # the employee is later renamed, moved to a different office, or removed
    # from the directory entirely. Not kept in sync with later employee edits.
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    employee_office: Mapped[str] = mapped_column(String(100), nullable=False)

    # Free-text, not an enum: a recognition program's award names change over
    # time (Employee of the Month, Perfect Attendance, a one-off shoutout,
    # ...) — same reasoning as Employee.department/position not being a
    # closed set.
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    awarded_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Nullable + ON DELETE SET NULL, same reasoning as ActivityLog.account_id
    # — an award (and its "who gave this" record) outlives the granting
    # account being deleted.
    awarded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), index=True
    )
    awarded_by_label: Mapped[str] = mapped_column(String(200), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    employee: Mapped["Employee"] = relationship()
    awarded_by: Mapped["Account | None"] = relationship()
