"""Spreadsheet import (preview/commit) and raw-row export for attendance
violation records — ported from the standalone attendance app's
app/routers/import_export.py.
"""

import io
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_account, require_violation_writer
from app.core.db import get_db
from app.models.account import Account
from app.models.violation import EmailStatus, Office, ViolationRecord, ViolationType
from app.schemas.violation import ImportCommitRequest, ImportPreviewResult, ImportResult
from app.services.violation_export import export_csv, export_xlsx
from app.services.violation_import import commit_import_rows, parse_tracker_file

router = APIRouter(tags=["violation-import-export"], dependencies=[Depends(require_account)])

WriterAccount = Annotated[Account, Depends(require_violation_writer)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post("/violations/import/preview", response_model=ImportPreviewResult)
async def preview_import(file: Annotated[UploadFile, File()], _account: WriterAccount) -> ImportPreviewResult:
    """Parses and validates the uploaded tracker but writes nothing to the
    database — the UI shows this as a checklist so a writer can exclude rows
    before anything is committed."""
    contents = await file.read()
    return parse_tracker_file(filename=file.filename or "import", file_bytes=contents)


@router.post("/violations/import/commit", response_model=ImportResult)
async def commit_import(payload: ImportCommitRequest, db: DbSession, account: WriterAccount) -> ImportResult:
    """Commits the rows the user kept from the preview step."""
    return await commit_import_rows(db, filename=payload.filename, rows=payload.rows, account=account)


@router.get("/violations/export")
async def export_records(
    db: DbSession,
    _account: WriterAccount,
    office: Office | None = None,
    violation_type: ViolationType | None = None,
    email_status: EmailStatus | None = None,
    format: Annotated[str, Query(pattern="^(xlsx|csv)$")] = "xlsx",
) -> StreamingResponse:
    stmt = select(ViolationRecord).where(ViolationRecord.is_deleted.is_(False))
    if office:
        stmt = stmt.where(ViolationRecord.office == office)
    if violation_type:
        stmt = stmt.where(ViolationRecord.violation_type == violation_type)
    if email_status:
        stmt = stmt.where(ViolationRecord.email_status == email_status)
    result = await db.execute(stmt)
    records = list(result.scalars().all())

    if format == "csv":
        data = export_csv(records)
        media_type = "text/csv"
        filename = "attendance_violations_export.csv"
    else:
        data = export_xlsx(records)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "attendance_violations_export.xlsx"

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
