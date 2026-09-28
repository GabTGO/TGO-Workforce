"""HMO Management — replaces the earlier frontend-only prototype
(src/data/hmo-mock.ts) with a real, database-backed module matching the SOP
handed off by the Projects Team (TGO_HMO_Management_Portal_Update_
Requirements.docx, prepared 2026-09-28): eligibility -> manager evaluation ->
enrollment -> ETIQA activation -> card release -> billing -> offboarding/
removal, for both employees (principal members) and their dependents.

Design rule carried from the SOP everywhere in this module: Enrollment Status
(where the employee is in the enrollment workflow) and Member Status (whether
the membership is currently usable) are two independent fields, never
conflated into one.

One wide table, HmoMember, holds both principal and dependent rows — matching
the SOP's own framing ("HMO Members: master list of principal AND dependent
members") and its section 4.2 fields (member_type, principal_member link,
relationship all living on the same entity, not a separate Dependent table).
Plan-tier fields (rank, room & board, MBL, dental, APE) are free-text, not
enums — same reasoning as Employee.department/position: a renegotiated
coverage tier shouldn't need a migration.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.employee import Employee


class HmoMemberType(enum.StrEnum):
    PRINCIPAL = "Principal"
    DEPENDENT = "Dependent"


class HmoEmploymentStatus(enum.StrEnum):
    """The SOP's own 4-value list — deliberately separate from
    Employee.status (Active/Resigned/Terminated only): "Withdrawn" describes
    an HMO application outcome, not a real employment state."""

    ACTIVE = "Active"
    RESIGNED = "Resigned"
    TERMINATED = "Terminated"
    WITHDRAWN = "Withdrawn"


class HmoManagerEvaluation(enum.StrEnum):
    NOT_YET_REQUIRED = "Not Yet Required"
    PENDING = "Pending"
    APPROVED = "Approved"
    EXTENDED = "Extended"
    ON_HOLD = "On Hold"
    NOT_APPROVED = "Not Approved"


class HmoRelationship(enum.StrEnum):
    SPOUSE = "Spouse"
    CHILD = "Child"
    PARENT = "Parent"
    OTHER = "Other"


class HmoMemberStatus(enum.StrEnum):
    """Whether the membership is currently usable — separate from
    enrollment_status below, per the SOP's own design rule."""

    NOT_YET_ACTIVE = "Not Yet Active"
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    SUSPENDED = "Suspended"
    TERMINATED = "Terminated"


class HmoBillingStatus(enum.StrEnum):
    NOT_YET_BILLED = "Not Yet Billed"
    INCLUDED_IN_BILLING = "Included in Billing"
    ADJUSTMENT_REQUIRED = "Adjustment Required"
    FOR_REMOVAL = "For Removal"
    REMOVED_FROM_BILLING = "Removed from Billing"


class HmoEnrollmentStatus(enum.StrEnum):
    """Where the employee is in the enrollment workflow — separate from
    member_status above, per the SOP's own design rule."""

    NOT_ELIGIBLE = "Not Eligible"
    FOR_MANAGER_EVALUATION = "For Manager Evaluation"
    WAITING_FOR_REQUIREMENTS = "Waiting for Requirements"
    READY_FOR_ENDORSEMENT = "Ready for Endorsement"
    ENDORSED_TO_ETIQA = "Endorsed to ETIQA"
    FOR_PROCESSING = "For Processing"
    ACTIVATED = "Activated"
    ON_HOLD = "On Hold"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"


class HmoVirtualCardStatus(enum.StrEnum):
    NOT_AVAILABLE = "Not Available"
    AVAILABLE = "Available"
    SENT_TO_EMPLOYEE = "Sent to Employee"


class HmoPhysicalCardStatus(enum.StrEnum):
    NOT_REQUESTED = "Not Requested"
    FOR_PROCESSING = "For Processing"
    READY_FOR_RELEASE = "Ready for Release"
    RECEIVED_BY_HR = "Received by HR"
    RELEASED_TO_EMPLOYEE = "Released to Employee"
    RETURNED = "Returned"
    LOST = "Lost"
    REPLACEMENT_REQUESTED = "Replacement Requested"


class HmoRemovalStatus(enum.StrEnum):
    NOT_REQUIRED = "Not Required"
    PENDING_ENDORSEMENT = "Pending Endorsement"
    ENDORSED = "Endorsed"
    FOR_PROCESSING = "For Processing"
    REMOVED = "Removed"


class HmoInactiveReason(enum.StrEnum):
    RESIGNED = "Resigned"
    TERMINATED = "Terminated"
    END_OF_CONTRACT = "End of Contract"
    FAILED_ELIGIBILITY = "Failed Eligibility"
    EMPLOYEE_REQUEST = "Employee Request"
    OTHER = "Other"


class HmoRequestStatus(enum.StrEnum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


def _enum_column(enum_cls: type[enum.StrEnum], name: str, **kwargs):
    return mapped_column(
        Enum(enum_cls, name=name, values_callable=lambda ec: [e.value for e in ec]),
        **kwargs,
    )


class HmoMember(Base):
    __tablename__ = "hmo_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_type: Mapped[HmoMemberType] = _enum_column(
        HmoMemberType, "hmo_member_type", nullable=False, index=True
    )

    # --- Principal-only (nullable) ---------------------------------------
    employee_id: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("employees.id", ondelete="SET NULL"), index=True
    )
    # Snapshotted at creation time, same reasoning as Award.employee_name/
    # employee_office — this row's history should read correctly even after
    # the employee is later renamed, moved, or removed from the directory.
    employee_name: Mapped[str | None] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(100))
    employment_status: Mapped[HmoEmploymentStatus | None] = _enum_column(
        HmoEmploymentStatus, "hmo_employment_status"
    )
    hire_date: Mapped[date | None] = mapped_column(Date)
    eligibility_date: Mapped[date | None] = mapped_column(Date)
    manager_evaluation: Mapped[HmoManagerEvaluation | None] = _enum_column(
        HmoManagerEvaluation, "hmo_manager_evaluation"
    )

    # --- Dependent-only (nullable) ----------------------------------------
    principal_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hmo_members.id", ondelete="CASCADE"), index=True
    )
    relationship_to_principal: Mapped[HmoRelationship | None] = _enum_column(
        HmoRelationship, "hmo_relationship"
    )
    dependent_name: Mapped[str | None] = mapped_column(String(200))
    birthday: Mapped[date | None] = mapped_column(Date)

    # --- Membership & coverage (any row) -----------------------------------
    hmo_card_number: Mapped[str | None] = mapped_column(String(100))
    member_status: Mapped[HmoMemberStatus] = _enum_column(
        HmoMemberStatus, "hmo_member_status", default=HmoMemberStatus.NOT_YET_ACTIVE, nullable=False
    )
    # Free text, not enums — a renegotiated coverage tier shouldn't need a
    # migration (same reasoning as Employee.department/position).
    rank: Mapped[str | None] = mapped_column(String(50))
    room_and_board: Mapped[str | None] = mapped_column(String(50))
    mbl: Mapped[str | None] = mapped_column(String(50))
    dental: Mapped[str | None] = mapped_column(String(50))
    ape: Mapped[str | None] = mapped_column(String(50))

    # --- Payment ------------------------------------------------------------
    monthly_premium: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    biweekly_deduction: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    billing_status: Mapped[HmoBillingStatus] = _enum_column(
        HmoBillingStatus, "hmo_billing_status", default=HmoBillingStatus.NOT_YET_BILLED, nullable=False
    )
    last_billing_month: Mapped[date | None] = mapped_column(Date)
    billing_remarks: Mapped[str | None] = mapped_column(Text)

    # --- Enrollment tracking -------------------------------------------------
    enrollment_status: Mapped[HmoEnrollmentStatus] = _enum_column(
        HmoEnrollmentStatus,
        "hmo_enrollment_status",
        default=HmoEnrollmentStatus.NOT_ELIGIBLE,
        nullable=False,
        index=True,
    )
    date_endorsed_to_etiqa: Mapped[date | None] = mapped_column(Date)
    hmo_effectivity_date: Mapped[date | None] = mapped_column(Date)
    requirements_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enrollment_remarks: Mapped[str | None] = mapped_column(Text)

    # --- Card tracking --------------------------------------------------------
    virtual_card_status: Mapped[HmoVirtualCardStatus] = _enum_column(
        HmoVirtualCardStatus,
        "hmo_virtual_card_status",
        default=HmoVirtualCardStatus.NOT_AVAILABLE,
        nullable=False,
    )
    virtual_card_available_date: Mapped[date | None] = mapped_column(Date)
    physical_card_status: Mapped[HmoPhysicalCardStatus] = _enum_column(
        HmoPhysicalCardStatus,
        "hmo_physical_card_status",
        default=HmoPhysicalCardStatus.NOT_REQUESTED,
        nullable=False,
    )
    physical_card_received_by_hr_date: Mapped[date | None] = mapped_column(Date)
    physical_card_released_date: Mapped[date | None] = mapped_column(Date)
    physical_card_returned_date: Mapped[date | None] = mapped_column(Date)

    # --- Removal / offboarding --------------------------------------------------
    removal_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    removal_status: Mapped[HmoRemovalStatus] = _enum_column(
        HmoRemovalStatus, "hmo_removal_status", default=HmoRemovalStatus.NOT_REQUIRED, nullable=False
    )
    removal_endorsed_date: Mapped[date | None] = mapped_column(Date)
    inactive_date: Mapped[date | None] = mapped_column(Date)
    inactive_reason: Mapped[HmoInactiveReason | None] = _enum_column(
        HmoInactiveReason, "hmo_inactive_reason"
    )
    removal_remarks: Mapped[str | None] = mapped_column(Text)

    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    employee: Mapped["Employee | None"] = relationship(viewonly=True)
    updated_by: Mapped["Account | None"] = relationship(viewonly=True, lazy="selectin")
    principal_member: Mapped["HmoMember | None"] = relationship(
        remote_side=[id], viewonly=True, lazy="selectin"
    )

    @property
    def display_name(self) -> str:
        """Whichever name applies for this row's type — used everywhere a
        member needs a single label, so callers don't need to branch on
        member_type themselves."""
        if self.member_type == HmoMemberType.DEPENDENT:
            return self.dependent_name or "Unnamed dependent"
        return self.employee_name or "Unnamed member"

    @property
    def updated_by_name(self) -> str | None:
        if self.updated_by is None:
            return None
        return self.updated_by.display_name or self.updated_by.email


class HmoRequest(Base):
    """LOA, reimbursement, card-replacement, enrollment and other
    benefit-related requests tied to a member — the Requests tab."""

    __tablename__ = "hmo_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hmo_members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    request_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[HmoRequestStatus] = _enum_column(
        HmoRequestStatus, "hmo_request_status", default=HmoRequestStatus.PENDING, nullable=False
    )
    submitted_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    member: Mapped["HmoMember"] = relationship(viewonly=True, lazy="selectin")
    resolved_by: Mapped["Account | None"] = relationship(viewonly=True, lazy="selectin")

    @property
    def resolved_by_name(self) -> str | None:
        if self.resolved_by is None:
            return None
        return self.resolved_by.display_name or self.resolved_by.email


class HmoBillingPeriod(Base):
    """One row per month — HR manually enters what ETIQA actually billed, so
    it can be compared against the sum of currently-billed members'
    monthly_premium for the "Billing Variance" dashboard KPI and the Billing
    tab's reconciliation view."""

    __tablename__ = "hmo_billing_periods"
    __table_args__ = (UniqueConstraint("month", name="uq_hmo_billing_periods_month"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    month: Mapped[date] = mapped_column(Date, nullable=False)  # always the 1st of the month
    provider_invoice_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
