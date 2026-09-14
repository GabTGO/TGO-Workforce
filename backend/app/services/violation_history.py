"""Computes "previous attendance violation(s) for this month" — ported from
the standalone attendance app's app/services/violation_history.py, adapted to
async SQLAlchemy:

- same employee (matched by employee_email)
- violation_date in the same calendar month as the current record
- only rows that were actually EmailStatus.SENT count (not prepared/approved/
  held/failed/etc.)
- excludes the current record itself
- ordered chronologically, joined into one comma-separated line as
  "[Violation Type] M/D, [Violation Type] M/D" (matches the email template's
  "Previous attendance violation for this month: ..." line)
"""

from datetime import date

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.violation import EmailStatus, ViolationRecord
from app.schemas.violation import PreviousViolationEntry


async def get_previous_violations_for_month(
    db: AsyncSession,
    *,
    employee_email: str,
    violation_date: date,
    exclude_record_id: int | None = None,
) -> list[PreviousViolationEntry]:
    stmt = (
        select(ViolationRecord)
        .where(ViolationRecord.employee_email == employee_email)
        .where(ViolationRecord.email_status == EmailStatus.SENT)
        .where(extract("year", ViolationRecord.violation_date) == violation_date.year)
        .where(extract("month", ViolationRecord.violation_date) == violation_date.month)
    )
    if exclude_record_id is not None:
        stmt = stmt.where(ViolationRecord.id != exclude_record_id)
    stmt = stmt.order_by(ViolationRecord.violation_date.asc())

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        PreviousViolationEntry(
            violation_date=r.violation_date,
            violation_type=r.violation_type,
            violation_type_other=r.violation_type_other,
        )
        for r in rows
    ]


def format_previous_violations(entries: list[PreviousViolationEntry]) -> str:
    if not entries:
        return "N/A"
    return ", ".join(e.as_line() for e in entries)


async def resolve_previous_violations(
    db: AsyncSession, record: ViolationRecord
) -> tuple[list[PreviousViolationEntry], bool]:
    """The one place that decides what "previous attendance violation for
    this month" actually shows for a record — a manually-set
    previous_violations_override (see app/models/violation.py's docstring on
    that column) if the record has one, otherwise the auto-detected list from
    the logs. Both app/api/routes/violations.py's _to_detail (drives the
    wizard's preview) and app/services/violation_email_template.py's
    build_body (drives the real outgoing email) call this instead of
    duplicating the "override or auto-detect" branch, so the preview a person
    reviews before sending can never drift from what actually goes out.
    Returns (entries, is_override)."""
    if record.previous_violations_override is not None:
        return (
            [PreviousViolationEntry.model_validate(e) for e in record.previous_violations_override],
            True,
        )
    entries = await get_previous_violations_for_month(
        db,
        employee_email=record.employee_email,
        violation_date=record.violation_date,
        exclude_record_id=record.id,
    )
    return entries, False
