"""Read-only analytics overview backing the attendance dashboard's charts —
ported from the standalone attendance app's app/routers/analytics.py.
"""

from collections import Counter
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_account
from app.core.db import get_db
from app.models.violation import ViolationRecord
from app.schemas.violation import AnalyticsOverview

router = APIRouter(
    prefix="/violation-analytics", tags=["violation-analytics"], dependencies=[Depends(require_account)]
)


@router.get("/overview", response_model=AnalyticsOverview)
async def overview(db: Annotated[AsyncSession, Depends(get_db)]) -> AnalyticsOverview:
    result = await db.execute(select(ViolationRecord).where(ViolationRecord.is_deleted.is_(False)))
    all_records = list(result.scalars().all())
    now = datetime.now(timezone.utc)

    total = len(all_records)
    pending_prep = sum(1 for r in all_records if r.email_status.value == "Ready to Prepare")
    pending_approval = sum(1 for r in all_records if r.email_status.value == "Email Prepared")
    sent_this_month = sum(
        1
        for r in all_records
        if r.email_status.value == "Sent"
        and r.sent_at
        and r.sent_at.year == now.year
        and r.sent_at.month == now.month
    )
    failed_count = sum(1 for r in all_records if r.email_status.value == "Failed")

    by_type = Counter(r.violation_type_label for r in all_records)
    by_office = Counter(r.office.value for r in all_records)
    by_month = Counter(r.violation_date.strftime("%Y-%m") for r in all_records if r.violation_date)

    employee_counts = Counter(r.employee_name for r in all_records)
    top_employees = [
        {"employee_name": name, "count": count} for name, count in employee_counts.most_common(10)
    ]

    turnarounds = [
        (r.approved_at - r.prepared_at).total_seconds() / 60
        for r in all_records
        if r.approved_at and r.prepared_at
    ]
    avg_turnaround = sum(turnarounds) / len(turnarounds) if turnarounds else None

    return AnalyticsOverview(
        total_records=total,
        pending_preparation=pending_prep,
        pending_approval=pending_approval,
        sent_this_month=sent_this_month,
        failed_count=failed_count,
        by_violation_type=dict(by_type),
        by_office=dict(by_office),
        by_month=dict(sorted(by_month.items())),
        top_employees=top_employees,
        avg_approval_turnaround_minutes=avg_turnaround,
    )
