"""Import an .xlsx/.csv attendance tracker in two phases — ported from the
standalone attendance app's app/services/import_service.py, adapted to async
SQLAlchemy for the commit step (parsing itself is plain sync pandas code,
same reasoning as violation_export.py/violation_reports.py):

1. `parse_tracker_file` — reads and validates every row (violation type is
   one of the four known values, employee email present and well-formed,
   required fields populated, "No reason given" preserved verbatim) but
   writes nothing to the database. Returns every row, valid or not, so the
   UI can show a confirmation step with a checkbox per row before anything
   is committed.
2. `commit_import_rows` — takes the rows the user chose to keep (echoed back
   from the preview, not re-parsed from the file) and actually creates them.
   Re-validates defensively rather than trusting the client.
"""

import io
import re
from datetime import date, datetime

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.activity_log import ActivityCategory
from app.models.violation import EmailStatus, ImportBatch, Office, ViolationRecord, ViolationType
from app.schemas.violation import (
    ImportCommitRow,
    ImportPreviewResult,
    ImportPreviewRow,
    ImportResult,
    ImportRowError,
)
from app.services.activity_log import record_activity

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Accept common header spellings from the existing Excel tracker.
COLUMN_ALIASES = {
    "employee name": "employee_name",
    "name": "employee_name",
    "employee email": "employee_email",
    "email": "employee_email",
    "violation / request": "violation_type",
    "violation/request": "violation_type",
    "violation type": "violation_type",
    "date": "violation_date",
    "reason": "reason",
    "office": "office",
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename = {}
    for col in df.columns:
        key = str(col).strip().lower()
        if key in COLUMN_ALIASES:
            rename[col] = COLUMN_ALIASES[key]
    return df.rename(columns=rename)


def _validate_fields(*, employee_name, employee_email, violation_type, violation_date, office) -> list[str]:
    errors = []
    if not employee_name:
        errors.append("Missing employee name")
    email = str(employee_email or "").strip()
    if not email or not EMAIL_RE.match(email):
        errors.append("Missing or invalid employee email")
    vtype = str(violation_type or "").strip()
    valid_types = {v.value for v in ViolationType}
    if vtype not in valid_types:
        errors.append(f"Violation / Request must be one of {sorted(valid_types)}")
    if not violation_date:
        errors.append("Missing date")
    office_val = str(office or "PH").strip().upper()
    if office_val not in {o.value for o in Office}:
        errors.append("Office must be PH or CO")
    return errors


def _parse_date(value) -> date | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def parse_tracker_file(*, filename: str, file_bytes: bytes) -> ImportPreviewResult:
    if filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    df = _normalize_columns(df)

    rows: list[ImportPreviewRow] = []
    for idx, raw_row in df.iterrows():
        row = raw_row.to_dict()
        parsed_date = _parse_date(row.get("violation_date"))
        reason = row.get("reason")
        # A blank Excel/CSV cell comes back from pandas as NaN (a float), not
        # None or "" — str(nan) is the literal text "nan", so it must be
        # caught explicitly or a blank Reason column silently becomes the
        # word "nan" in the email instead of "No reason given".
        if reason is None or (isinstance(reason, float) and pd.isna(reason)) or str(reason).strip() == "":
            reason = "No reason given"
        else:
            reason = str(reason).strip()
        office = str(row.get("office") or "PH").strip().upper()
        employee_name = str(row.get("employee_name") or "").strip()
        employee_email = str(row.get("employee_email") or "").strip().lower()
        violation_type = str(row.get("violation_type") or "").strip()

        errors = _validate_fields(
            employee_name=employee_name,
            employee_email=employee_email,
            violation_type=violation_type,
            violation_date=parsed_date,
            office=office,
        )

        rows.append(
            ImportPreviewRow(
                row_number=idx + 2,
                valid=len(errors) == 0,
                errors=errors,
                office=office or None,
                employee_name=employee_name or None,
                employee_email=employee_email or None,
                violation_type=violation_type or None,
                violation_date=parsed_date.isoformat() if parsed_date else None,
                reason=reason,
            )
        )

    valid_count = sum(1 for r in rows if r.valid)
    return ImportPreviewResult(
        filename=filename,
        row_count=len(rows),
        valid_count=valid_count,
        invalid_count=len(rows) - valid_count,
        rows=rows,
    )


async def commit_import_rows(
    db: AsyncSession,
    *,
    filename: str,
    rows: list[ImportCommitRow],
    account: Account,
) -> ImportResult:
    batch = ImportBatch(filename=filename, imported_by=account.id, row_count=len(rows))
    db.add(batch)
    await db.flush()  # get batch.id without committing yet

    errors: list[ImportRowError] = []
    success_count = 0
    imported_ids: list[str] = []

    for row in rows:
        parsed_date = _parse_date(row.violation_date)
        row_errors = _validate_fields(
            employee_name=row.employee_name,
            employee_email=row.employee_email,
            violation_type=row.violation_type,
            violation_date=parsed_date,
            office=row.office,
        )
        if row_errors:
            errors.append(
                ImportRowError(row_number=row.row_number or 0, errors=row_errors, raw=row.model_dump())
            )
            continue

        record = ViolationRecord(
            office=Office(row.office.strip().upper()),
            employee_name=row.employee_name.strip(),
            employee_email=row.employee_email.strip().lower(),
            violation_type=ViolationType(row.violation_type.strip()),
            violation_date=parsed_date,
            reason=row.reason or "No reason given",
            email_status=EmailStatus.READY_TO_PREPARE,
            created_by=account.id,
        )
        db.add(record)
        await db.flush()
        imported_ids.append(record.violation_record_id)
        success_count += 1

    batch.success_count = success_count
    batch.error_count = len(errors)
    batch.status = "completed" if not errors else ("partial" if success_count else "failed")

    if success_count:
        await record_activity(
            db,
            action="Imported violation records",
            category=ActivityCategory.ATTENDANCE,
            account=account,
            target=f"{success_count} record{'s' if success_count != 1 else ''}",
            details={"batch_id": batch.id, "source_filename": filename, "record_ids": imported_ids},
            commit=False,
        )
    await db.commit()
    await db.refresh(batch)

    return ImportResult(
        batch_id=batch.id,
        row_count=len(rows),
        success_count=success_count,
        error_count=len(errors),
        errors=errors,
    )
