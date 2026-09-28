from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.hmo import (
    HmoBillingStatus,
    HmoEmploymentStatus,
    HmoEnrollmentStatus,
    HmoInactiveReason,
    HmoManagerEvaluation,
    HmoMemberStatus,
    HmoMemberType,
    HmoPhysicalCardStatus,
    HmoRelationship,
    HmoRemovalStatus,
    HmoRequestStatus,
    HmoVirtualCardStatus,
)


class HmoMemberBase(BaseModel):
    member_type: HmoMemberType

    # Principal-only
    employee_id: str | None = None
    employment_status: HmoEmploymentStatus | None = None
    hire_date: date | None = None
    eligibility_date: date | None = None
    manager_evaluation: HmoManagerEvaluation | None = None

    # Dependent-only
    principal_member_id: UUID | None = None
    relationship_to_principal: HmoRelationship | None = None
    dependent_name: str | None = None
    birthday: date | None = None

    # Membership & coverage
    hmo_card_number: str | None = None
    member_status: HmoMemberStatus = HmoMemberStatus.NOT_YET_ACTIVE
    rank: str | None = None
    room_and_board: str | None = None
    mbl: str | None = None
    dental: str | None = None
    ape: str | None = None

    # Payment
    monthly_premium: Decimal | None = None
    biweekly_deduction: Decimal | None = None
    billing_status: HmoBillingStatus = HmoBillingStatus.NOT_YET_BILLED
    last_billing_month: date | None = None
    billing_remarks: str | None = None

    # Enrollment tracking
    enrollment_status: HmoEnrollmentStatus = HmoEnrollmentStatus.NOT_ELIGIBLE
    date_endorsed_to_etiqa: date | None = None
    hmo_effectivity_date: date | None = None
    requirements_complete: bool = False
    enrollment_remarks: str | None = None

    # Card tracking
    virtual_card_status: HmoVirtualCardStatus = HmoVirtualCardStatus.NOT_AVAILABLE
    virtual_card_available_date: date | None = None
    physical_card_status: HmoPhysicalCardStatus = HmoPhysicalCardStatus.NOT_REQUESTED
    physical_card_received_by_hr_date: date | None = None
    physical_card_released_date: date | None = None
    physical_card_returned_date: date | None = None

    # Removal / offboarding
    removal_required: bool = False
    removal_status: HmoRemovalStatus = HmoRemovalStatus.NOT_REQUIRED
    removal_endorsed_date: date | None = None
    inactive_date: date | None = None
    inactive_reason: HmoInactiveReason | None = None
    removal_remarks: str | None = None


class HmoMemberCreate(HmoMemberBase):
    """Used by the Add HMO Member form. employee_name/department are always
    server-snapshotted from the linked Employee record, never supplied by the
    client — see app/api/routes/hmo.py's create handler."""


class HmoMemberUpdate(BaseModel):
    """Every field optional — a PATCH only touches what's actually sent,
    same shape as EmployeeUpdate."""

    employment_status: HmoEmploymentStatus | None = None
    manager_evaluation: HmoManagerEvaluation | None = None
    relationship_to_principal: HmoRelationship | None = None
    dependent_name: str | None = None
    birthday: date | None = None
    hmo_card_number: str | None = None
    member_status: HmoMemberStatus | None = None
    rank: str | None = None
    room_and_board: str | None = None
    mbl: str | None = None
    dental: str | None = None
    ape: str | None = None
    monthly_premium: Decimal | None = None
    biweekly_deduction: Decimal | None = None
    billing_status: HmoBillingStatus | None = None
    last_billing_month: date | None = None
    billing_remarks: str | None = None
    enrollment_status: HmoEnrollmentStatus | None = None
    date_endorsed_to_etiqa: date | None = None
    hmo_effectivity_date: date | None = None
    requirements_complete: bool | None = None
    enrollment_remarks: str | None = None
    virtual_card_status: HmoVirtualCardStatus | None = None
    virtual_card_available_date: date | None = None
    physical_card_status: HmoPhysicalCardStatus | None = None
    physical_card_received_by_hr_date: date | None = None
    physical_card_released_date: date | None = None
    physical_card_returned_date: date | None = None
    removal_required: bool | None = None
    removal_status: HmoRemovalStatus | None = None
    removal_endorsed_date: date | None = None
    inactive_date: date | None = None
    inactive_reason: HmoInactiveReason | None = None
    removal_remarks: str | None = None


class HmoMemberRead(HmoMemberBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employee_name: str | None = None
    department: str | None = None
    display_name: str
    updated_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class HmoRequestBase(BaseModel):
    member_id: UUID
    request_type: str
    status: HmoRequestStatus = HmoRequestStatus.PENDING
    submitted_date: date
    notes: str | None = None


class HmoRequestCreate(HmoRequestBase):
    pass


class HmoRequestUpdate(BaseModel):
    status: HmoRequestStatus | None = None
    notes: str | None = None


class HmoRequestRead(HmoRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime


class HmoBillingPeriodBase(BaseModel):
    month: date
    provider_invoice_amount: Decimal
    notes: str | None = None


class HmoBillingPeriodCreate(HmoBillingPeriodBase):
    pass


class HmoBillingPeriodUpdate(BaseModel):
    provider_invoice_amount: Decimal | None = None
    notes: str | None = None


class HmoBillingPeriodRead(HmoBillingPeriodBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
