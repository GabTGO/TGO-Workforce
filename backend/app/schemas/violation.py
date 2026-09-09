"""Pydantic schemas for attendance violation tracking — ported from the
standalone attendance app's app/schemas.py, restyled onto this app's
Base/Create/Update/Read split (see app/schemas/employee.py) and
ConfigDict(from_attributes=True) convention.

Dropped from the source: UserOut/UserUpdate/PaginatedUsers/UserRosterOut
(Account already has equivalent schemas in app/schemas/account.py) and
AuditLogOut/PaginatedAuditLog (the audit trail is now the shared
ActivityLog — see app/schemas/activity_log.py — surfaced for a single
violation record via GET /violations/{id}/history in
app/api/routes/violations.py rather than a per-domain audit schema).
"""

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.violation import EmailStatus, Office, ViolationType


# ---------- Violation records ----------


class ViolationRecordBase(BaseModel):
    office: Office
    employee_name: str
    employee_email: EmailStr
    violation_type: ViolationType
    # Required (and validated as non-blank) by the create route when
    # violation_type is ViolationType.OTHER — the free-text label for a
    # violation that doesn't fit the four fixed categories. Ignored/cleared
    # for any other violation_type.
    violation_type_other: Optional[str] = None
    violation_date: date
    reason: Optional[str] = "No reason given"


class ViolationRecordCreate(ViolationRecordBase):
    """Backs the "New violation record" wizard's first step. Finishing this
    form *is* "add the row and move it to Ready to Prepare" — one action, not
    two — mirroring the source app's create_record()."""


class ViolationRecordUpdate(BaseModel):
    """Every field optional — a PATCH only touches what's actually sent, same
    pattern as EmployeeUpdate. Only allowed while the record is Draft, Ready
    to Prepare, or Needs Correction — enforced in the route, not here."""

    office: Optional[Office] = None
    employee_name: Optional[str] = None
    employee_email: Optional[EmailStr] = None
    violation_type: Optional[ViolationType] = None
    violation_type_other: Optional[str] = None
    violation_date: Optional[date] = None
    reason: Optional[str] = None
    # Both are raw strings (not EmailStr) rather than a stricter type, because
    # an empty string is a meaningful value — "clear the override, go back to
    # the default" — and cc_addresses can hold more than one address. The
    # route does the actual email-format validation and empty-string-to-None
    # normalization.
    cc_addresses: Optional[str] = None
    from_address: Optional[str] = None


class PreviousViolationEntry(BaseModel):
    violation_date: date
    violation_type: ViolationType
    violation_type_other: Optional[str] = None

    def as_line(self) -> str:
        label = (
            self.violation_type_other
            if self.violation_type == ViolationType.OTHER and self.violation_type_other
            else self.violation_type.value
        )
        return f"{self.violation_date.month}/{self.violation_date.day} - {label}"


class ViolationRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    violation_record_id: str
    office: Office
    employee_name: str
    employee_email: str
    violation_type: ViolationType
    violation_type_other: Optional[str] = None
    violation_type_label: Optional[str] = None
    violation_date: date
    reason: Optional[str] = None
    email_status: EmailStatus
    prepared_at: Optional[datetime] = None
    approved_by: Optional[uuid.UUID] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    sent_to: Optional[str] = None
    zoho_message_id: Optional[str] = None
    automation_result: Optional[str] = None
    automation_error: Optional[str] = None
    resend_of: Optional[int] = None
    resent_at: Optional[datetime] = None
    cc_addresses: Optional[str] = None
    from_address: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ViolationRecordDetail(ViolationRecordRead):
    previous_violations: list[PreviousViolationEntry] = []
    subject_preview: Optional[str] = None
    body_preview: Optional[str] = None
    # The *effective* From/Cc that will actually be used when this record is
    # sent — the per-record override if one is set, otherwise the configured
    # default (see build_from_address()/build_cc_address() in
    # app/services/violation_email_template.py). Every preview surface in the
    # UI should show these rather than a flat hardcoded/config-only address.
    from_preview: Optional[str] = None
    cc_preview: Optional[str] = None


class PaginatedRecords(BaseModel):
    items: list[ViolationRecordRead]
    total: int


# ---------- Bulk record actions ----------


class BulkIdsRequest(BaseModel):
    ids: list[int]


class BulkSkip(BaseModel):
    id: int
    violation_record_id: Optional[str] = None
    reason: str


class BulkDeleteResult(BaseModel):
    deleted: list[int]
    skipped: list[BulkSkip]


class BulkSendOutcome(BaseModel):
    id: int
    violation_record_id: str
    employee_name: str
    error: Optional[str] = None


class BulkSendResult(BaseModel):
    sent: list[BulkSendOutcome]
    failed: list[BulkSendOutcome]
    skipped: list[BulkSkip]


# ---------- Import ----------


class ImportRowError(BaseModel):
    row_number: int
    errors: list[str]
    raw: dict[str, Any]


class ImportResult(BaseModel):
    batch_id: int
    row_count: int
    success_count: int
    error_count: int
    errors: list[ImportRowError]


class ImportPreviewRow(BaseModel):
    """One parsed spreadsheet row, before anything is written to the
    database. `valid` + `errors` mirror the source app's validation checks;
    the frontend uses them to pre-check valid rows and disable invalid ones in
    the confirmation step, but nothing is committed until /violations/import/commit."""

    row_number: int
    valid: bool
    errors: list[str]
    office: Optional[str] = None
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    violation_type: Optional[str] = None
    violation_date: Optional[str] = None  # ISO date string, or the raw unparsed value
    reason: Optional[str] = None


class ImportPreviewResult(BaseModel):
    filename: str
    row_count: int
    valid_count: int
    invalid_count: int
    rows: list[ImportPreviewRow]


class ImportCommitRow(BaseModel):
    """A row the user chose to keep in the preview step, echoed back verbatim
    rather than re-parsed from the file a second time."""

    row_number: Optional[int] = None
    office: str
    employee_name: str
    employee_email: str
    violation_type: str
    violation_date: str
    reason: Optional[str] = None


class ImportCommitRequest(BaseModel):
    filename: str
    rows: list[ImportCommitRow]


# ---------- Reports / analytics ----------


class ReportFilter(BaseModel):
    office: Optional[Office] = None
    violation_type: Optional[ViolationType] = None
    email_status: Optional[EmailStatus] = None
    employee_email: Optional[EmailStr] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    format: str = "xlsx"  # "xlsx" | "pdf"


class AnalyticsOverview(BaseModel):
    total_records: int
    pending_preparation: int
    pending_approval: int
    sent_this_month: int
    failed_count: int
    by_violation_type: dict[str, int]
    by_office: dict[str, int]
    by_month: dict[str, int]
    top_employees: list[dict[str, Any]]
    avg_approval_turnaround_minutes: Optional[float] = None


# ---------- Email sender config ----------


class EmailSenderConfig(BaseModel):
    """Exposes the *actual* configured Zoho Mail sender so the UI's email
    previews never show a stale/hardcoded address."""

    from_address: str
    # Every address Zoho is known to actually accept as a sender on this
    # account (from_address plus settings.zoho_mail_known_aliases) — always
    # includes from_address as the first entry. Backs the "From address
    # override" picker: a dropdown of known-good choices instead of free text
    # someone could mistype or pick an unvalidated address for.
    known_from_addresses: list[str] = []
