"""Builds the subject/body for the approved violation-notice email — ported
from the standalone attendance app's app/services/email_template.py, adapted
to async SQLAlchemy (build_body needs a DB lookup for previous-violations
history).

Subject: Attendance Policy Violation - [Violation Type] - [Employee Name] [M/D]
Body: fixed template with What/When/Reason/Previous-violation-history, sent as
HTML (see violation_email.py's mailFormat) so the employee's name and field
labels render with real emphasis instead of a flat wall of plain text. Every
value pulled from record data is HTML-escaped before being interpolated,
since employee_name/reason are free-text fields.
"""

import html

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.violation import ViolationRecord
from app.services.violation_history import format_previous_violations, get_previous_violations_for_month

settings = get_settings()


def build_subject(record: ViolationRecord) -> str:
    d = record.violation_date
    return (
        f"Attendance Policy Violation - {record.violation_type_label} - "
        f"{record.employee_name} {d.month}/{d.day}"
    )


def build_from_address(record: ViolationRecord) -> str:
    """The From address this record's email will actually be sent with: its
    own override if one was set via PATCH /violations/{id}, otherwise the
    globally configured sender (settings.zoho_mail_from_address)."""
    return record.from_address or settings.zoho_mail_from_address


def build_cc_address(record: ViolationRecord) -> str:
    """The Cc header this record's email will actually be sent with.

    The sending mailbox stays copied on every notice, so that default is
    always included — a record's cc_addresses override (one or more
    comma-separated addresses) *adds* recipients on top of it rather than
    replacing it, so the mandatory attendance-mailbox copy can't accidentally
    be dropped from a per-record edit. Addresses are de-duplicated
    case-insensitively."""
    default_cc = settings.zoho_mail_from_address
    extra = [a.strip() for a in (record.cc_addresses or "").split(",") if a.strip()]
    seen = {default_cc.lower()}
    combined = [default_cc]
    for address in extra:
        if address.lower() not in seen:
            seen.add(address.lower())
            combined.append(address)
    return ", ".join(combined)


async def build_body(db: AsyncSession, record: ViolationRecord) -> str:
    first_name = record.employee_name.split()[0] if record.employee_name else record.employee_name
    reason = record.reason or "No reason given"

    previous = await get_previous_violations_for_month(
        db,
        employee_email=record.employee_email,
        violation_date=record.violation_date,
        exclude_record_id=record.id,
    )
    previous_text = format_previous_violations(previous)
    previous_html = html.escape(previous_text).replace("\n", "<br>")

    return f"""<p>Hi <strong>{html.escape(first_name)}</strong>,</p>
<p>You are receiving this email as a written notification of a violation of our attendance policy. Please take a moment to review the details below and reply to this email to acknowledge receipt.</p>
<p>
<strong>What:</strong> {html.escape(record.violation_type_label)}<br>
<strong>When:</strong> {record.violation_date.strftime('%m/%d/%Y')}<br>
<strong>Reason:</strong> {html.escape(reason)}<br>
<strong>Previous attendance violation for this month:</strong><br>
{previous_html}
</p>
<p>For any questions and/or concerns, please reach out to: <a href="mailto:{html.escape(settings.zoho_mail_from_address)}">{html.escape(settings.zoho_mail_from_address)}</a></p>
<p>Regards,<br>
<strong>TGO Attendance Team</strong></p>"""
