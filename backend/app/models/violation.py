"""Attendance violation tracking — ported from the standalone "TGO Attendance
Violation Email Automation" app's app/models.py, modernized to this app's
Mapped/mapped_column style (see app/models/employee.py) and re-pointed at the
merged app's Account table instead of that app's own (now-defunct) User table.

Dropped entirely from the source: User, UserRole, AuditAction, AuditLog — this
app has one shared Account table (app/models/account.py) and one shared audit
trail (app/models/activity_log.py; see app/services/activity_log.py), not a
separate per-domain user/audit pair. Every FK that pointed at the source's
users.id (an Integer PK) now points at accounts.id, a UUID PK — see
approved_by/created_by below.
"""

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.account import Account


class Office(enum.StrEnum):
    PH = "PH"
    CO = "CO"


class ViolationType(enum.StrEnum):
    LATE_ARRIVAL = "Late Arrival"
    CALL_OUT = "Call Out"
    EARLY_OUT = "Early Out"
    NCNS = "NCNS"
    # A record with this type must also set violation_type_other (see
    # ViolationRecord.violation_type_label below) — "Other" alone isn't a
    # useful label on its own.
    OTHER = "Other"


class EmailStatus(enum.StrEnum):
    DRAFT = "Draft"  # "Draft / Not Ready" in the source app's SOP
    READY_TO_PREPARE = "Ready to Prepare"
    EMAIL_PREPARED = "Email Prepared"
    APPROVED = "Approved"
    HOLD = "Hold"
    NEEDS_CORRECTION = "Needs Correction"
    SENT = "Sent"
    FAILED = "Failed"
    RESEND_APPROVED = "Resend Approved"


def gen_violation_record_id() -> str:
    year = datetime.utcnow().year
    return f"VR-{year}-{uuid.uuid4().hex[:8].upper()}"


class ViolationRecord(Base):
    __tablename__ = "violation_records"

    # Auto-incrementing integer PK, same as the source app — nothing else FKs
    # into this table except ImportBatch (informational only, no real FK) and
    # this table's own self-referencing resend_of, and ActivityLog only ever
    # stores a free-text `target` (the business-facing violation_record_id
    # string below), never a real FK — so there's no need for this PK to
    # match Account's UUID style.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    violation_record_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, default=gen_violation_record_id, index=True
    )

    office: Mapped[Office] = mapped_column(
        Enum(Office, name="violation_office", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    violation_type: Mapped[ViolationType] = mapped_column(
        Enum(
            ViolationType,
            name="violation_type",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    # Only meaningful when violation_type is ViolationType.OTHER — the
    # free-text label HR/People Ops typed in for a violation that doesn't fit
    # the four fixed categories. See violation_type_label below for the one
    # place that decides whether to show this or the fixed enum value.
    violation_type_other: Mapped[str | None] = mapped_column(String(255))
    violation_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)  # keep "No reason given" verbatim when that's the value

    email_status: Mapped[EmailStatus] = mapped_column(
        Enum(
            EmailStatus,
            name="violation_email_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=EmailStatus.DRAFT,
        nullable=False,
        index=True,
    )

    prepared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_to: Mapped[str | None] = mapped_column(String(255))
    zoho_message_id: Mapped[str | None] = mapped_column(String(255))
    automation_result: Mapped[str | None] = mapped_column(String(64))  # success | failed | blocked | skipped
    automation_error: Mapped[str | None] = mapped_column(Text)

    resend_of: Mapped[int | None] = mapped_column(Integer, ForeignKey("violation_records.id"))
    resent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Per-record overrides for the Zoho Mail "From"/"Cc" headers. Both are
    # nullable and mean "use the configured default" when unset — see
    # build_from_address()/build_cc_address() in
    # app/services/violation_email_template.py, which every send path (single
    # send-now, bulk-send-now, the worker) calls to compute the actual header
    # value. cc_addresses is a comma-separated string of one or more addresses
    # to CC *in addition to* the default; from_address replaces the default
    # sender outright, for whichever validated aliases exist on the connected
    # Zoho Mail account (settings.zoho_mail_known_aliases).
    cc_addresses: Mapped[str | None] = mapped_column(String(500))
    from_address: Mapped[str | None] = mapped_column(String(255))

    # Soft delete: the activity log references this record only by a
    # free-text target (the violation_record_id string), and that audit trail
    # must never be allowed to disappear, so a real DELETE is never issued
    # here. This flag just excludes the record from every list/get/export/
    # report/analytics query — see the shared _get_or_404 helper in
    # app/api/routes/violations.py.
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # lazy="selectin": with AsyncSession, a default lazy=("select") relationship
    # can only be loaded inside an awaited call — accessing it synchronously
    # (e.g. from a property read during Pydantic's model_validate()) raises
    # MissingGreenlet. selectin loading issues its follow-up SELECT as part of
    # the same awaited db.execute()/db.get() call that loaded the parent row,
    # so approved_by_name/created_by_name below are always safe to read
    # afterward with no extra .options(selectinload(...)) at each call site.
    approved_by_account: Mapped["Account | None"] = relationship(
        "Account", foreign_keys=[approved_by], viewonly=True, lazy="selectin"
    )
    created_by_account: Mapped["Account | None"] = relationship(
        "Account", foreign_keys=[created_by], viewonly=True, lazy="selectin"
    )

    @property
    def violation_type_label(self) -> str:
        """The display label for this record's violation type: the custom
        text typed in when violation_type is Other, otherwise the fixed enum
        value ("Late Arrival", etc). Every place that shows a violation type
        to a person or writes one into an email/export/report reads this
        instead of `violation_type.value` directly."""
        if self.violation_type == ViolationType.OTHER and self.violation_type_other:
            return self.violation_type_other
        return self.violation_type.value

    @property
    def approved_by_name(self) -> str | None:
        return _format_account_label(self.approved_by_account)

    @property
    def created_by_name(self) -> str | None:
        return _format_account_label(self.created_by_account)


def _format_account_label(account: object | None) -> str | None:
    """'Jane Doe (People Ops)' — used everywhere a record needs to show *who*
    did something, not just a raw account id. Falls back to the email when no
    display name was set. Kept as a free function (rather than a method on
    Account, which this module doesn't own) so app/models/violation.py stays
    self-contained; app/models/account.py is a shared, untouched file."""
    if account is None:
        return None
    from app.models.account import AccountRole  # local import: avoid a hard module-level cycle

    role_labels = {
        AccountRole.ADMIN: "Admin",
        AccountRole.PEOPLE_OPS: "People Ops",
        AccountRole.HR: "HR",
        AccountRole.PROJECTS: "Projects",
        AccountRole.RECRUITMENT_LEAD: "Recruitment Lead",
        AccountRole.ONBOARDING_SPECIALIST: "Onboarding Specialist",
        AccountRole.VIEWER: "Viewer",
    }
    name = getattr(account, "display_name", None) or getattr(account, "email", None) or "Unknown"
    role = getattr(account, "role", None)
    role_label = role_labels.get(role, role.value if role else "")
    return f"{name} ({role_label})" if role_label else name


class ImportBatch(Base):
    """One row per spreadsheet import commit (see app/services/violation_import.py).
    imported_by is informational only — no FK enforcement to accounts.id is
    strictly required here since nothing else joins against this table, but
    it's declared the same way as the other actor columns above for
    consistency."""

    __tablename__ = "violation_import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    imported_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="completed", nullable=False)  # completed | failed | partial
