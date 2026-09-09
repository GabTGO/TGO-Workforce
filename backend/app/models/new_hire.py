"""The NewHire table — the onboarding checklist tracker ported from the
standalone tgo-onboarding-app (backend/app/models/new_hire.py there), matching
that app's 7-item SOP checklist field for field, but rebuilt with the same
typed Mapped/mapped_column style as app/models/employee.py instead of the
source app's bare Column(...) style, and a UUID primary key matching
Account's style — this table has no natural human-facing identity the way
Employee.id ("TGO-1001") does, so there's no reason to invent one.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class NewHire(Base):
    __tablename__ = "new_hires"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role_title: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    # Kept as free text (not a real Date column), matching the source app's
    # SOP-driven display format — e.g. "Sept 8, 2026 / 9:00 AM" — rather than
    # a strict calendar date.
    start_date: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    recruitment_lead: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    onboarding_specialist: Mapped[str] = mapped_column(String(150), nullable=False, default="")

    # 1-7 checklist columns from the SOP.
    jo_discussion: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmation_signed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    welcome_email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Auto-stamped with the acting account's display name on the first
    # welcome_email_sent transition (see the route's update handler) — never
    # cleared again afterward, even if welcome_email_sent is later
    # unchecked. Never client-settable directly (see NewHireCreate/Update).
    completed_by: Mapped[str | None] = mapped_column(String(200))
    new_hire_info: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    id_photo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    credentials_created: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
