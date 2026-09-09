"""Computes "previous attendance violation(s) for this month" — ported from
the standalone attendance app's app/services/violation_history.py, adapted to
async SQLAlchemy:

- same employee (matched by employee_email)
- violation_date in the same calendar month as the current record
- only rows that were actually EmailStatus.SENT count (not prepared/approved/
  held/failed/etc.)
- excludes the current record itself
- ordered chronologically, one per line as "M/D - [Violation Type]"
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
    return "\n".join(e.as_line() for e in entries)
