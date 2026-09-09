"""Generates a formatted summary report (the "Generate Report" button), as
opposed to the raw row-dump export in violation_export.py — ported from the
standalone attendance app's app/services/report_service.py.

xlsx report: grouped counts + the filtered row list on a second sheet.
pdf report: a simple one-page summary via reportlab.

Same "takes an already-fetched list, stays plain sync code" shape as
violation_export.py — see that module's docstring.
"""

import io
from collections import Counter
from collections.abc import Sequence

import pandas as pd

from app.models.violation import ViolationRecord
from app.services.violation_export import to_dataframe


def build_summary(df: pd.DataFrame) -> dict:
    return {
        "total": len(df),
        "by_status": Counter(df["email_status"]) if not df.empty else Counter(),
        "by_violation_type": Counter(df["violation_type"]) if not df.empty else Counter(),
        "by_office": Counter(df["office"]) if not df.empty else Counter(),
    }


def generate_xlsx_report(records: Sequence[ViolationRecord]) -> bytes:
    df = to_dataframe(records)
    summary = build_summary(df)

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        summary_rows = [{"Metric": "Total records", "Value": summary["total"]}]
        for group_name, counter in [
            ("By status", summary["by_status"]),
            ("By violation type", summary["by_violation_type"]),
            ("By office", summary["by_office"]),
        ]:
            summary_rows.append({"Metric": group_name, "Value": ""})
            for k, v in counter.items():
                summary_rows.append({"Metric": f"  {k}", "Value": v})
        pd.DataFrame(summary_rows).to_excel(writer, index=False, sheet_name="Summary")
        df.to_excel(writer, index=False, sheet_name="Records")
    return buf.getvalue()


def generate_pdf_report(records: Sequence[ViolationRecord]) -> bytes:
    df = to_dataframe(records)
    summary = build_summary(df)

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "reportlab is not installed. Add it to requirements.txt to enable PDF reports "
            "(xlsx reports work without it)."
        ) from exc

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    y = height - 50

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Attendance Violation Report")
    y -= 30

    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Total records: {summary['total']}")
    y -= 25

    for title, counter in [
        ("By status", summary["by_status"]),
        ("By violation type", summary["by_violation_type"]),
        ("By office", summary["by_office"]),
    ]:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, title)
        y -= 18
        c.setFont("Helvetica", 10)
        for k, v in counter.items():
            c.drawString(65, y, f"{k}: {v}")
            y -= 15
        y -= 10
        if y < 80:
            c.showPage()
            y = height - 50

    c.save()
    return buf.getvalue()
