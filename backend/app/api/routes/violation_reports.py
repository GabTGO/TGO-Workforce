"""Formatted summary reports (xlsx/pdf) for attendance violations — ported
from the standalone attendance app's app/routers/reports.py. Prefix is
"/violation-reports" (not "/reports") to leave room for a general-purpose
reports endpoint elsewhere in the merged app without a collision.
"""

import io
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_account, require_permission
from app.core.db import get_db
from app.models.account import Account
from app.models.activity_log import ActivityCategory
from app.models.permission import Permission
from app.models.violation import EmailStatus, Office, ViolationRecord, ViolationType
from app.services.activity_log import record_activity
from app.services.violation_export import to_dataframe
from app.services.violation_reports import build_summary, generate_pdf_report, generate_xlsx_report

router = APIRouter(
    prefix="/violation-reports",
    tags=["violation-reports"],
    dependencies=[Depends(require_permission(Permission.ATTENDANCE_VIEW))],
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
PREVIEW_ROW_LIMIT = 50


async def _filtered_records(
    db: AsyncSession,
    office: Office | None,
    violation_type: ViolationType | None,
    email_status: EmailStatus | None,
    employee_email: str | None,
) -> list[ViolationRecord]:
    stmt = select(ViolationRecord).where(ViolationRecord.is_deleted.is_(False))
    if office:
        stmt = stmt.where(ViolationRecord.office == office)
    if violation_type:
        stmt = stmt.where(ViolationRecord.violation_type == violation_type)
    if email_status:
        stmt = stmt.where(ViolationRecord.email_status == email_status)
    if employee_email:
        stmt = stmt.where(ViolationRecord.employee_email == employee_email.lower())
    stmt = stmt.order_by(ViolationRecord.violation_date.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/preview")
async def preview_report(
    db: DbSession,
    office: Office | None = None,
    violation_type: ViolationType | None = None,
    email_status: EmailStatus | None = None,
    employee_email: str | None = None,
):
    """Lets a signed-in account see what a report will actually contain — the
    same counts and matching rows /violation-reports/generate would produce —
    before spending a download on it. Capped at PREVIEW_ROW_LIMIT rows; the
    Excel/PDF export itself is uncapped."""
    records = await _filtered_records(db, office, violation_type, email_status, employee_email)
    df = to_dataframe(records)
    summary = build_summary(df)

    sample = records[:PREVIEW_ROW_LIMIT]
    rows = [
        {
            "violation_record_id": r.violation_record_id,
            "office": r.office.value,
            "employee_name": r.employee_name,
            "employee_email": r.employee_email,
            "violation_type": r.violation_type_label,
            "violation_date": r.violation_date.isoformat() if r.violation_date else None,
            "email_status": r.email_status.value,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        }
        for r in sample
    ]

    return {
        "total": summary["total"],
        "by_status": dict(summary["by_status"]),
        "by_violation_type": dict(summary["by_violation_type"]),
        "by_office": dict(summary["by_office"]),
        "rows": rows,
        "truncated": summary["total"] > len(rows),
    }


@router.get("/generate")
async def generate_report(
    db: DbSession,
    account: Annotated[Account, Depends(require_account)],
    office: Office | None = None,
    violation_type: ViolationType | None = None,
    email_status: EmailStatus | None = None,
    employee_email: str | None = None,
    format: Annotated[str, Query(pattern="^(xlsx|pdf)$")] = "xlsx",
) -> StreamingResponse:
    records = await _filtered_records(db, office, violation_type, email_status, employee_email)

    if format == "pdf":
        data = generate_pdf_report(records)
        media_type = "application/pdf"
        filename = "attendance_violation_report.pdf"
    else:
        data = generate_xlsx_report(records)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "attendance_violation_report.xlsx"

    await record_activity(
        db,
        action="Generated violation report",
        category=ActivityCategory.ATTENDANCE,
        account=account,
        details={"format": format, "office": office.value if office else None, "violation_type": violation_type.value if violation_type else None},
    )

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/employee/{employee_email}")
async def employee_history(employee_email: str, db: DbSession):
    result = await db.execute(
        select(ViolationRecord)
        .where(ViolationRecord.is_deleted.is_(False))
        .where(ViolationRecord.employee_email == employee_email.lower())
        .order_by(ViolationRecord.violation_date.desc())
    )
    records = result.scalars().all()
    return [
        {
            "violation_record_id": r.violation_record_id,
            "violation_date": r.violation_date,
            "violation_type": r.violation_type_label,
            "email_status": r.email_status.value,
        }
        for r in records
    ]
