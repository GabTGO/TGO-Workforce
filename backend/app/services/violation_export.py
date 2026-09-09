"""Exports a list of violation records as .xlsx or .csv (backup/sharing — this
is one-way, database-to-file, not a live sync target) — ported from the
standalone attendance app's app/services/export_service.py.

Unlike the source app (which took a live sync SQLAlchemy Query and called
`.all()` internally), `_to_dataframe` here takes an already-fetched list of
ViolationRecord objects — the route does the async `await db.execute(select(...))`
and hands the resulting rows to this module, which stays plain synchronous
pandas/openpyxl code (neither library has an async API, so there's nothing to
gain from making this module async).
"""

import io
from collections.abc import Sequence

import pandas as pd

from app.models.violation import ViolationRecord

COLUMNS = [
    "violation_record_id",
    "office",
    "employee_name",
    "employee_email",
    "violation_type",
    "violation_date",
    "reason",
    "email_status",
    "prepared_at",
    "approved_at",
    "sent_at",
    "sent_to",
    "zoho_message_id",
    "automation_result",
    "automation_error",
    "created_at",
]


def to_dataframe(records: Sequence[ViolationRecord]) -> pd.DataFrame:
    rows = [
        {
            "violation_record_id": r.violation_record_id,
            "office": r.office.value,
            "employee_name": r.employee_name,
            "employee_email": r.employee_email,
            "violation_type": r.violation_type_label,
            "violation_date": r.violation_date,
            "reason": r.reason,
            "email_status": r.email_status.value,
            "prepared_at": r.prepared_at,
            "approved_at": r.approved_at,
            "sent_at": r.sent_at,
            "sent_to": r.sent_to,
            "zoho_message_id": r.zoho_message_id,
            "automation_result": r.automation_result,
            "automation_error": r.automation_error,
            "created_at": r.created_at,
        }
        for r in records
    ]
    return pd.DataFrame(rows, columns=COLUMNS)


def export_xlsx(records: Sequence[ViolationRecord]) -> bytes:
    df = to_dataframe(records)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Violations")
    return buf.getvalue()


def export_csv(records: Sequence[ViolationRecord]) -> bytes:
    df = to_dataframe(records)
    return df.to_csv(index=False).encode("utf-8")
