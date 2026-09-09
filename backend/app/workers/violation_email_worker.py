"""Scheduled send worker for attendance violation notices — ported from the
standalone attendance app's app/worker.py, adapted to this app's async
SQLAlchemy setup.

Run this as its own process/service (Start Command:
`python -m app.workers.violation_email_worker`), separate from the API
service, so a slow/stuck send doesn't block API requests. It polls for
Approved / Resend Approved records and sends them.

Deliberately does NOT do the "prepare" step here — preparation happens
synchronously via POST /violations/{id}/prepare when a writer sets a record to
Ready to Prepare (see the frontend attendance-violations page). Only the send
step (gated on approval) needs to run unattended.

Uses AsyncSessionLocal directly (not the FastAPI get_db dependency) since this
runs outside a request/response cycle.
"""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.violation import EmailStatus, ViolationRecord
from app.services.activity_log import record_activity
from app.services.violation_email import ZohoMailError, send_email
from app.services.violation_email_template import build_body, build_cc_address, build_from_address, build_subject

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("violation_email_worker")
settings = get_settings()


async def process_approved_records() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ViolationRecord)
            .where(ViolationRecord.is_deleted.is_(False))
            .where(ViolationRecord.email_status.in_([EmailStatus.APPROVED, EmailStatus.RESEND_APPROVED]))
        )
        pending = list(result.scalars().all())

        for record in pending:
            is_resend = record.email_status == EmailStatus.RESEND_APPROVED
            subject = build_subject(record)
            body = await build_body(db, record)
            try:
                message_id = await send_email(
                    to_address=record.employee_email,
                    subject=subject,
                    content=body,
                    from_address=build_from_address(record),
                    cc_address=build_cc_address(record),
                )
            except ZohoMailError as exc:
                logger.error("Send failed for %s: %s", record.violation_record_id, exc)
                record.email_status = EmailStatus.FAILED
                record.automation_result = "failed"
                record.automation_error = str(exc)
                await db.flush()
                await record_activity(
                    db,
                    action="Violation email send failed",
                    category=ActivityCategory.ATTENDANCE,
                    actor_label="System",
                    target=record.violation_record_id,
                    details={"error": str(exc)},
                    severity=ActivitySeverity.WARNING,
                    commit=False,
                )
                await db.commit()
                continue

            record.email_status = EmailStatus.SENT
            record.sent_at = datetime.now(UTC)
            record.sent_to = record.employee_email
            record.zoho_message_id = message_id
            record.automation_result = "success"
            record.automation_error = None
            if is_resend:
                record.resent_at = record.sent_at
            await db.flush()
            await record_activity(
                db,
                action="Resent violation email" if is_resend else "Sent violation email",
                category=ActivityCategory.ATTENDANCE,
                actor_label="System",
                target=record.violation_record_id,
                details={"message_id": message_id},
                commit=False,
            )
            await db.commit()
            logger.info("Sent %s to %s", record.violation_record_id, record.employee_email)


async def main_loop() -> None:
    logger.info(
        "Violation email send worker started, polling every %s seconds",
        settings.violation_send_worker_poll_seconds,
    )
    while True:
        try:
            await process_approved_records()
        except Exception:  # noqa: BLE001 - keep the worker alive across transient errors
            logger.exception("Unhandled error in violation email send worker loop")
        await asyncio.sleep(settings.violation_send_worker_poll_seconds)


if __name__ == "__main__":
    asyncio.run(main_loop())
