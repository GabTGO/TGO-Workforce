"""Scheduled database backup poll loop.

Runs in the same worker process as violation_email_worker.py (see
app/workers/main.py, the combined entrypoint the worker Railway service
actually runs) rather than its own service — both are cheap, infrequent
polling loops, so there's no reason to pay for a third always-on service
just for this one.

Checks the Super Admin-configured schedule (app/models/backup_schedule.py)
once a minute and, when it's due, runs a pg_dump-backed snapshot via
app/services/backup.py — the same function the manual "Backup Now" button
in the UI calls.
"""

import asyncio
import logging

from app.core.db import AsyncSessionLocal
from app.services.backup import maybe_run_scheduled_backup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backup_worker")

# How often to check whether a scheduled backup is due — independent of the
# schedule's own daily/weekly cadence; this just bounds how close to the
# configured time-of-day it actually fires. A minute's slop is fine for a
# backup (unlike the violation email worker, nothing here is time-critical).
POLL_SECONDS = 60


async def check_schedule() -> None:
    async with AsyncSessionLocal() as db:
        await maybe_run_scheduled_backup(db)


async def main_loop() -> None:
    logger.info("Backup schedule worker started, polling every %s seconds", POLL_SECONDS)
    while True:
        try:
            await check_schedule()
        except Exception:  # noqa: BLE001 - keep the worker alive across transient errors
            logger.exception("Unhandled error in backup schedule worker loop")
        await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main_loop())
