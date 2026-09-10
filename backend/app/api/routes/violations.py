"""Core CRUD + status-transition endpoints for attendance violation records —
ported from the standalone attendance app's app/routers/records.py, fully
async and re-pointed at this app's shared Account/ActivityLog tables instead
of that app's own User/AuditLog.

Status actions are explicit endpoints (prepare/approve/hold/needs-correction/
resend) rather than a generic PATCH-the-status, so every transition is
unambiguous in the activity log and the workflow's state machine is enforced
in code, not left to whoever edits a field.

Auth: every route requires Permission.ATTENDANCE_VIEW (router-level —
matrix-configurable; Admin/Super Admin always have it). Write actions
(create/update/prepare/mark-ready) additionally require require_violation_writer
(Permission.ATTENDANCE_MANAGE — HR and Projects hold it by default, per the
TGO Attendance Policy Violation Email Automation SOP section 17).
Approve/hold/needs-correction/resend/send-now/bulk-send-now/bulk-preview
additionally require require_violation_approver (Permission.ATTENDANCE_APPROVE
— HR only by default, SOP section 10's explicit-HR-approval gate).
Delete/bulk-delete require require_violation_admin (same as require_admin
elsewhere, Admin/Super-Admin-only hard delete).

TEMPORARY: all three of those dependencies currently also gate on a single
developer account regardless of role, while this module is still in
progress — see app/core/auth.py's _require_attendance_in_progress_dev.
"""

import re
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    require_permission,
    require_violation_admin,
    require_violation_approver,
    require_violation_writer,
)
from app.core.config import get_settings
from app.core.db import get_db
from app.models.account import Account
from app.models.activity_log import ActivityCategory, ActivityLog, ActivitySeverity
from app.models.permission import Permission
from app.models.violation import EmailStatus, Office, ViolationRecord, ViolationType
from app.schemas.activity_log import ActivityLogRead
from app.schemas.violation import (
    BulkDeleteResult,
    BulkIdsRequest,
    BulkSendOutcome,
    BulkSendResult,
    BulkSendViaOutlookResult,
    BulkSkip,
    EmailSenderConfig,
    PaginatedRecords,
    SendViaOutlookRequest,
    ViolationRecordCreate,
    ViolationRecordDetail,
    ViolationRecordRead,
    ViolationRecordUpdate,
)
from app.services.activity_log import record_activity
from app.services.app_settings import get_app_settings
from app.services.notify import notify_permission_holders
from app.services.violation_email import ZohoMailError, send_email
from app.services.violation_email_template import build_body, build_cc_address, build_from_address, build_subject
from app.services.violation_history import get_previous_violations_for_month

router = APIRouter(
    prefix="/violations",
    tags=["violations"],
    dependencies=[Depends(require_permission(Permission.ATTENDANCE_VIEW))],
)

WriterAccount = Annotated[Account, Depends(require_violation_writer)]
ApproverAccount = Annotated[Account, Depends(require_violation_approver)]
AdminAccount = Annotated[Account, Depends(require_violation_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_cc_addresses(raw: str) -> str | None:
    """Validates and normalizes the comma-separated cc_addresses field from an
    edit. Blank -> None (clears the override, back to just the default
    attendance-mailbox Cc). Each non-blank address must look like an email;
    the normalized, comma-space-joined form is what gets stored."""
    addresses = [a.strip() for a in raw.split(",") if a.strip()]
    if not addresses:
        return None
    for address in addresses:
        if not _EMAIL_RE.match(address):
            raise HTTPException(400, f"'{address}' doesn't look like a valid email address")
    return ", ".join(addresses)


def _normalize_from_address(raw: str) -> str | None:
    """Blank -> None (clears the override, back to the configured default
    sender). Otherwise must look like a single email address."""
    address = raw.strip()
    if not address:
        return None
    if not _EMAIL_RE.match(address):
        raise HTTPException(400, f"'{address}' doesn't look like a valid email address")
    return address


def _resolve_violation_type_other(violation_type: ViolationType, raw_other: str | None) -> str | None:
    """violation_type_other only means something when violation_type is
    ViolationType.OTHER — requires non-blank text in that case; silently
    clears it to None for every other violation_type."""
    if violation_type != ViolationType.OTHER:
        return None
    text = (raw_other or "").strip()
    if not text:
        raise HTTPException(400, "Please specify the violation type for 'Other'")
    return text


async def _get_or_404(db: AsyncSession, record_id: int) -> ViolationRecord:
    result = await db.execute(
        select(ViolationRecord).where(
            ViolationRecord.id == record_id, ViolationRecord.is_deleted.is_(False)
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(404, "Violation record not found")
    return record


def _validate_for_preparation(record: ViolationRecord) -> list[str]:
    errors = []
    if not record.employee_email:
        errors.append("Employee email is required")
    if not record.employee_name:
        errors.append("Employee name is required")
    if record.reason is None or str(record.reason).strip() == "":
        errors.append("Reason is required (use 'No reason given' if none was provided)")
    return errors


async def _to_detail(db: AsyncSession, record: ViolationRecord) -> ViolationRecordDetail:
    previous = await get_previous_violations_for_month(
        db,
        employee_email=record.employee_email,
        violation_date=record.violation_date,
        exclude_record_id=record.id,
    )
    detail = ViolationRecordDetail.model_validate(record)
    detail.previous_violations = previous
    detail.subject_preview = build_subject(record)
    detail.body_preview = await build_body(db, record)
    detail.from_preview = build_from_address(record)
    detail.cc_preview = build_cc_address(record)
    return detail


# ---------- config (declared before /{record_id} so it isn't swallowed by it) ----------


@router.get("/email-sender-config", response_model=EmailSenderConfig)
async def email_sender_config() -> EmailSenderConfig:
    """Exposes the actual configured Zoho Mail sender so the UI's email
    previews/pickers never show a stale/hardcoded address."""
    settings = get_settings()
    known = [settings.zoho_mail_from_address, *settings.zoho_mail_known_alias_list]
    # De-dupe while preserving order, in case from_address is repeated in the
    # known-aliases list.
    seen: set[str] = set()
    deduped = []
    for address in known:
        if address and address.lower() not in seen:
            seen.add(address.lower())
            deduped.append(address)
    return EmailSenderConfig(from_address=settings.zoho_mail_from_address, known_from_addresses=deduped)


# ---------- list / read ----------


@router.get("", response_model=PaginatedRecords)
async def list_records(
    db: DbSession,
    office: Office | None = None,
    violation_type: ViolationType | None = None,
    email_status: EmailStatus | None = None,
    employee_email: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: Annotated[int, Query(le=500)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedRecords:
    stmt = select(ViolationRecord).where(ViolationRecord.is_deleted.is_(False))
    if office:
        stmt = stmt.where(ViolationRecord.office == office)
    if violation_type:
        stmt = stmt.where(ViolationRecord.violation_type == violation_type)
    if email_status:
        stmt = stmt.where(ViolationRecord.email_status == email_status)
    if employee_email:
        stmt = stmt.where(ViolationRecord.employee_email == employee_email.lower())
    if date_from:
        stmt = stmt.where(ViolationRecord.violation_date >= date_from)
    if date_to:
        stmt = stmt.where(ViolationRecord.violation_date <= date_to)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(ViolationRecord.violation_date.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    return PaginatedRecords(items=items, total=total)


@router.get("/{record_id}", response_model=ViolationRecordDetail)
async def get_record(record_id: int, db: DbSession) -> ViolationRecordDetail:
    record = await _get_or_404(db, record_id)
    return await _to_detail(db, record)


@router.get("/{record_id}/history", response_model=list[ActivityLogRead])
async def record_history(record_id: int, db: DbSession) -> list[ActivityLog]:
    """The audit trail for one record — pulled from the shared ActivityLog
    table (category=ATTENDANCE), matched by the business-facing
    violation_record_id string stored in `target`, rather than a separate
    per-domain audit table."""
    record = await _get_or_404(db, record_id)
    result = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.category == ActivityCategory.ATTENDANCE)
        .where(ActivityLog.target == record.violation_record_id)
        .order_by(ActivityLog.created_at.asc())
    )
    return list(result.scalars().all())


# ---------- create / edit ----------


@router.post("", response_model=ViolationRecordRead)
async def create_record(
    payload: ViolationRecordCreate, db: DbSession, account: WriterAccount
) -> ViolationRecord:
    """The create form collects every field the tracker requires, so
    finishing this form *is* "add the row and move it to Ready to Prepare" —
    one action, not two."""
    data = payload.model_dump()
    data["violation_type_other"] = _resolve_violation_type_other(
        payload.violation_type, data.get("violation_type_other")
    )
    record = ViolationRecord(**data, created_by=account.id, email_status=EmailStatus.READY_TO_PREPARE)
    db.add(record)
    await db.flush()

    await record_activity(
        db,
        action="Created violation record",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{record_id}", response_model=ViolationRecordRead)
async def update_record(
    record_id: int, payload: ViolationRecordUpdate, db: DbSession, account: WriterAccount
) -> ViolationRecord:
    record = await _get_or_404(db, record_id)
    if record.email_status not in (
        EmailStatus.DRAFT,
        EmailStatus.READY_TO_PREPARE,
        EmailStatus.NEEDS_CORRECTION,
    ):
        raise HTTPException(400, "Only Draft, Ready to Prepare, or Needs Correction records can be edited")

    changes = payload.model_dump(exclude_unset=True)
    if "cc_addresses" in changes:
        changes["cc_addresses"] = _normalize_cc_addresses(changes["cc_addresses"] or "")
    if "from_address" in changes:
        changes["from_address"] = _normalize_from_address(changes["from_address"] or "")
    if "violation_type" in changes or "violation_type_other" in changes:
        # Validate against the *resulting* state, not just whichever of the
        # two fields this particular edit touched.
        final_type = changes.get("violation_type", record.violation_type)
        final_other = changes.get("violation_type_other", record.violation_type_other)
        changes["violation_type_other"] = _resolve_violation_type_other(final_type, final_other)

    for field, value in changes.items():
        setattr(record, field, value)
    await db.flush()

    await record_activity(
        db,
        action="Updated violation record",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        details={"changed_fields": list(changes.keys())},
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


# ---------- status actions ----------


@router.post("/{record_id}/prepare", response_model=ViolationRecordRead)
async def prepare_record(record_id: int, db: DbSession, account: WriterAccount) -> ViolationRecord:
    record = await _get_or_404(db, record_id)
    if record.email_status != EmailStatus.READY_TO_PREPARE:
        raise HTTPException(400, "Record must be in Ready to Prepare status")

    errors = _validate_for_preparation(record)
    if errors:
        raise HTTPException(400, {"validation_errors": errors})

    record.email_status = EmailStatus.EMAIL_PREPARED
    record.prepared_at = datetime.now(UTC)
    await db.flush()
    await record_activity(
        db,
        action="Prepared violation email",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    # Whoever prepared this (often Projects, per the SOP) isn't necessarily
    # watching the queue — nudge everyone who can actually approve it.
    await notify_permission_holders(
        db,
        Permission.ATTENDANCE_APPROVE,
        title="Violation email ready for review",
        body=f"{record.employee_name} — {record.violation_type_label} ({record.violation_date})",
        link="/attendance-violations",
        exclude_account_id=account.id,
        require_preference=Account.notify_on_violation_review,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{record_id}/mark-ready", response_model=ViolationRecordRead)
async def mark_ready_record(record_id: int, db: DbSession, account: WriterAccount) -> ViolationRecord:
    """Moves a record back into the Ready to Prepare queue. Covers three
    workflow cases with one endpoint: a still-incomplete Draft row is
    finished, a Hold is released, or a Needs Correction row has been fixed."""
    record = await _get_or_404(db, record_id)
    if record.email_status not in (EmailStatus.DRAFT, EmailStatus.HOLD, EmailStatus.NEEDS_CORRECTION):
        raise HTTPException(400, "Only Draft, Hold, or Needs Correction records can be marked ready")
    record.email_status = EmailStatus.READY_TO_PREPARE
    await db.flush()
    await record_activity(
        db,
        action="Marked violation record ready to prepare",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{record_id}/approve", response_model=ViolationRecordRead)
async def approve_record(record_id: int, db: DbSession, account: ApproverAccount) -> ViolationRecord:
    record = await _get_or_404(db, record_id)
    # Also allowed from Failed: a deliberate re-approval before a retry, reusing
    # the same activity-log action as a normal approval.
    if record.email_status not in (EmailStatus.EMAIL_PREPARED, EmailStatus.FAILED):
        raise HTTPException(400, "Record must be in Email Prepared or Failed status")
    record.email_status = EmailStatus.APPROVED
    record.approved_by = account.id
    record.approved_at = datetime.now(UTC)
    await db.flush()
    await record_activity(
        db,
        action="Approved violation record",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{record_id}/hold", response_model=ViolationRecordRead)
async def hold_record(record_id: int, db: DbSession, account: ApproverAccount) -> ViolationRecord:
    record = await _get_or_404(db, record_id)
    record.email_status = EmailStatus.HOLD
    await db.flush()
    await record_activity(
        db,
        action="Put violation record on hold",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{record_id}/needs-correction", response_model=ViolationRecordRead)
async def needs_correction_record(record_id: int, db: DbSession, account: ApproverAccount) -> ViolationRecord:
    record = await _get_or_404(db, record_id)
    record.email_status = EmailStatus.NEEDS_CORRECTION
    await db.flush()
    await record_activity(
        db,
        action="Flagged violation record as needing correction",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{record_id}/resend", response_model=ViolationRecordRead)
async def resend_record(record_id: int, db: DbSession, account: ApproverAccount) -> ViolationRecord:
    """Controlled resend: only fires from Sent, requires an explicit approver
    action, and is logged distinctly from the original send."""
    original = await _get_or_404(db, record_id)
    if original.email_status != EmailStatus.SENT:
        raise HTTPException(400, "Only a Sent record can be resent")

    original.email_status = EmailStatus.RESEND_APPROVED
    await db.flush()
    await record_activity(
        db,
        action="Approved violation record for resend",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=original.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(original)
    return original


# ---------- manual send-now (invoked by the worker normally; exposed for
# manual retry from the UI too) ----------


@router.post("/{record_id}/send-now", response_model=ViolationRecordRead)
async def send_now(record_id: int, db: DbSession, account: ApproverAccount) -> ViolationRecord:
    record = await _get_or_404(db, record_id)
    if record.email_status not in (EmailStatus.APPROVED, EmailStatus.RESEND_APPROVED):
        raise HTTPException(400, "Record must be Approved or Resend Approved to send")

    subject = build_subject(record)
    body = await build_body(db, record)
    is_resend = record.email_status == EmailStatus.RESEND_APPROVED

    try:
        message_id = await send_email(
            to_address=record.employee_email,
            subject=subject,
            content=body,
            from_address=build_from_address(record),
            cc_address=build_cc_address(record),
        )
    except ZohoMailError as exc:
        record.email_status = EmailStatus.FAILED
        record.automation_result = "failed"
        record.automation_error = str(exc)
        await db.flush()
        await record_activity(
            db,
            action="Violation email send failed",
            category=ActivityCategory.ATTENDANCE,
            account=account,
            target=record.violation_record_id,
            details={"error": str(exc)},
            severity=ActivitySeverity.WARNING,
            commit=False,
        )
        await notify_permission_holders(
            db,
            Permission.ATTENDANCE_APPROVE,
            title="Violation email failed to send",
            body=f"{record.employee_name} — {exc}",
            link="/attendance-violations",
            require_preference=Account.notify_on_violation_review,
            commit=False,
        )
        await db.commit()
        raise HTTPException(502, f"Send failed: {exc}") from exc

    record.email_status = EmailStatus.SENT
    record.sent_at = datetime.now(UTC)
    record.sent_to = record.employee_email
    record.zoho_message_id = message_id
    record.automation_result = "success"
    record.automation_error = None
    if is_resend:
        record.resent_at = datetime.now(UTC)
    await db.flush()
    await record_activity(
        db,
        action="Resent violation email" if is_resend else "Sent violation email",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        details={"message_id": message_id},
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record


# ---------- MS Outlook alternate send path (see app/models/app_settings.py's
# use_outlook_for_violations) ----------
#
# Neither route calls send_email()/Zoho at all — the record is simply marked
# Sent (automation_result="manual_outlook" instead of "success"), and the
# frontend opens the composed email in the approver's own MS Outlook via a
# mailto: link built from this response's subject/body/from/cc previews.
# There is no way for the backend to confirm what happens in Outlook after
# that — this is a "mark as sent" action, not a real delivery confirmation,
# which is exactly why it's gated behind an explicit Super Admin toggle and
# recorded distinctly in automation_result/the activity log.


def _apply_outlook_overrides(record: ViolationRecord, payload: SendViaOutlookRequest) -> None:
    if payload.from_address is not None:
        record.from_address = _normalize_from_address(payload.from_address)
    if payload.cc_addresses is not None:
        record.cc_addresses = _normalize_cc_addresses(payload.cc_addresses)


def _mark_sent_via_outlook(record: ViolationRecord) -> bool:
    """Returns whether this was a resend, for the caller's activity-log
    wording — same bookkeeping as send_now's success branch, minus the
    zoho_message_id (there isn't one) and with a distinct automation_result."""
    is_resend = record.email_status == EmailStatus.RESEND_APPROVED
    record.email_status = EmailStatus.SENT
    record.sent_at = datetime.now(UTC)
    record.sent_to = record.employee_email
    record.zoho_message_id = None
    record.automation_result = "manual_outlook"
    record.automation_error = None
    if is_resend:
        record.resent_at = datetime.now(UTC)
    return is_resend


@router.post("/{record_id}/send-via-outlook", response_model=ViolationRecordDetail)
async def send_via_outlook(
    record_id: int, payload: SendViaOutlookRequest, db: DbSession, account: ApproverAccount
) -> ViolationRecordDetail:
    app_settings = await get_app_settings(db)
    if not app_settings.use_outlook_for_violations:
        raise HTTPException(400, "Outlook sending isn't enabled. Ask a Super Admin to turn it on.")

    record = await _get_or_404(db, record_id)
    if record.email_status not in (EmailStatus.APPROVED, EmailStatus.RESEND_APPROVED):
        raise HTTPException(400, "Record must be Approved or Resend Approved to send")

    _apply_outlook_overrides(record, payload)
    is_resend = _mark_sent_via_outlook(record)
    await db.flush()
    await record_activity(
        db,
        action="Marked violation email as resent via Outlook" if is_resend else "Marked violation email as sent via Outlook",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        details={"method": "outlook"},
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return await _to_detail(db, record)


@router.post("/bulk-send-via-outlook", response_model=BulkSendViaOutlookResult)
async def bulk_send_via_outlook(payload: BulkIdsRequest, db: DbSession, account: ApproverAccount) -> BulkSendViaOutlookResult:
    """Same eligibility rule as bulk-send-now — only fires from Approved/
    Resend Approved, anything else is reported back as skipped. No per-record
    From/Cc overrides here (unlike the single-record route above); bulk keeps
    whatever each record already has."""
    app_settings = await get_app_settings(db)
    if not app_settings.use_outlook_for_violations:
        raise HTTPException(400, "Outlook sending isn't enabled. Ask a Super Admin to turn it on.")

    sent: list[ViolationRecordDetail] = []
    skipped: list[BulkSkip] = []
    for record_id in payload.ids:
        result = await db.execute(
            select(ViolationRecord).where(
                ViolationRecord.id == record_id, ViolationRecord.is_deleted.is_(False)
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            skipped.append(BulkSkip(id=record_id, reason="Not found or already deleted"))
            continue
        if record.email_status not in (EmailStatus.APPROVED, EmailStatus.RESEND_APPROVED):
            skipped.append(
                BulkSkip(
                    id=record_id,
                    violation_record_id=record.violation_record_id,
                    reason=f"Status is '{record.email_status.value}', not Approved",
                )
            )
            continue

        is_resend = _mark_sent_via_outlook(record)
        await db.flush()
        await record_activity(
            db,
            action="Marked violation email as resent via Outlook" if is_resend else "Marked violation email as sent via Outlook",
            category=ActivityCategory.ATTENDANCE,
            account=account,
            target=record.violation_record_id,
            details={"method": "outlook", "bulk": True},
            commit=False,
        )
        sent.append(await _to_detail(db, record))

    await db.commit()
    return BulkSendViaOutlookResult(sent=sent, skipped=skipped)


# ---------- bulk actions (violation table's checkbox selection) ----------


@router.post("/bulk-preview", response_model=list[ViolationRecordDetail])
async def bulk_preview_records(payload: BulkIdsRequest, db: DbSession, _account: ApproverAccount):
    """Feeds the bulk-send confirmation modal: the same rendered
    subject/body preview GET /violations/{id} returns, for a whole selection
    at once, so the checklist can show exactly what each email will say
    before anything actually sends."""
    details = []
    for record_id in payload.ids:
        result = await db.execute(
            select(ViolationRecord).where(
                ViolationRecord.id == record_id, ViolationRecord.is_deleted.is_(False)
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            continue
        details.append(await _to_detail(db, record))
    return details


@router.post("/bulk-delete", response_model=BulkDeleteResult)
async def bulk_delete_records(payload: BulkIdsRequest, db: DbSession, account: AdminAccount) -> BulkDeleteResult:
    """Same soft-delete as DELETE /violations/{id}, applied to a whole
    checkbox selection at once. Each row is validated independently so one bad
    id doesn't fail the whole batch — it's just reported back as skipped."""
    deleted: list[int] = []
    skipped: list[BulkSkip] = []
    for record_id in payload.ids:
        result = await db.execute(
            select(ViolationRecord).where(
                ViolationRecord.id == record_id, ViolationRecord.is_deleted.is_(False)
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            skipped.append(BulkSkip(id=record_id, reason="Not found or already deleted"))
            continue
        record.is_deleted = True
        deleted.append(record_id)

    if deleted:
        await db.flush()
        await record_activity(
            db,
            action="Bulk removed violation records",
            category=ActivityCategory.ATTENDANCE,
            account=account,
            target=f"{len(deleted)} record{'s' if len(deleted) != 1 else ''}",
            details={"ids": deleted},
            commit=False,
        )
    await db.commit()
    return BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.post("/bulk-send-now", response_model=BulkSendResult)
async def bulk_send_now(payload: BulkIdsRequest, db: DbSession, account: ApproverAccount) -> BulkSendResult:
    """Same rule as the single /send-now: only fires from Approved/Resend
    Approved. Anything else in the selection is reported back as skipped
    rather than silently ignored or erroring out the whole batch."""
    sent: list[BulkSendOutcome] = []
    failed: list[BulkSendOutcome] = []
    skipped: list[BulkSkip] = []

    for record_id in payload.ids:
        result = await db.execute(
            select(ViolationRecord).where(
                ViolationRecord.id == record_id, ViolationRecord.is_deleted.is_(False)
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            skipped.append(BulkSkip(id=record_id, reason="Not found or already deleted"))
            continue
        if record.email_status not in (EmailStatus.APPROVED, EmailStatus.RESEND_APPROVED):
            skipped.append(
                BulkSkip(
                    id=record_id,
                    violation_record_id=record.violation_record_id,
                    reason=f"Status is '{record.email_status.value}', not Approved",
                )
            )
            continue

        subject = build_subject(record)
        body = await build_body(db, record)
        is_resend = record.email_status == EmailStatus.RESEND_APPROVED

        try:
            message_id = await send_email(
                to_address=record.employee_email,
                subject=subject,
                content=body,
                from_address=build_from_address(record),
                cc_address=build_cc_address(record),
            )
        except ZohoMailError as exc:
            record.email_status = EmailStatus.FAILED
            record.automation_result = "failed"
            record.automation_error = str(exc)
            await db.flush()
            await record_activity(
                db,
                action="Violation email send failed",
                category=ActivityCategory.ATTENDANCE,
                account=account,
                target=record.violation_record_id,
                details={"error": str(exc), "bulk": True},
                severity=ActivitySeverity.WARNING,
                commit=False,
            )
            failed.append(
                BulkSendOutcome(
                    id=record_id,
                    violation_record_id=record.violation_record_id,
                    employee_name=record.employee_name,
                    error=str(exc),
                )
            )
            continue

        record.email_status = EmailStatus.SENT
        record.sent_at = datetime.now(UTC)
        record.sent_to = record.employee_email
        record.zoho_message_id = message_id
        record.automation_result = "success"
        record.automation_error = None
        if is_resend:
            record.resent_at = datetime.now(UTC)
        await db.flush()
        await record_activity(
            db,
            action="Resent violation email" if is_resend else "Sent violation email",
            category=ActivityCategory.ATTENDANCE,
            account=account,
            target=record.violation_record_id,
            details={"message_id": message_id, "bulk": True},
            commit=False,
        )
        sent.append(
            BulkSendOutcome(
                id=record_id, violation_record_id=record.violation_record_id, employee_name=record.employee_name
            )
        )

    if failed:
        # One summary notification for the whole batch rather than one per
        # failed record — a bad batch can fail dozens at once, and nobody
        # wants a flooded inbox for what's really one event.
        await notify_permission_holders(
            db,
            Permission.ATTENDANCE_APPROVE,
            title="Some violation emails failed to send",
            body=f"{len(failed)} of {len(payload.ids)} failed in this bulk send.",
            link="/attendance-violations",
            require_preference=Account.notify_on_violation_review,
            commit=False,
        )
    await db.commit()
    return BulkSendResult(sent=sent, failed=failed, skipped=skipped)


# ---------- delete ----------


@router.delete("/{record_id}", response_model=ViolationRecordRead)
async def delete_record(record_id: int, db: DbSession, account: AdminAccount) -> ViolationRecord:
    """Soft-delete only: the activity log references this record by its
    business-facing violation_record_id and must never be able to disappear
    along with it, so this flips is_deleted rather than issuing a real
    DELETE. Admin-only — the most destructive action here, even though
    nothing is physically removed."""
    record = await _get_or_404(db, record_id)
    record.is_deleted = True
    await db.flush()
    await record_activity(
        db,
        action="Removed violation record",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        target=record.violation_record_id,
        commit=False,
    )
    await db.commit()
    await db.refresh(record)
    return record
