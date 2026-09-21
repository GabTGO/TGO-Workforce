"""Database backup poll loop — the only place in this app that actually
runs pg_dump.

Runs in the same worker process as violation_email_worker.py (see
app/workers/main.py, the combined entrypoint the worker Railway service
actually runs) rather than its own service — both are cheap, infrequent
polling loops, so there's no reason to pay for a third always-on service
just for this one.

Every ~60s, this executes any manual "Backup Now" request the API queued
(app/api/routes/backups.py inserts a RUNNING row but never runs pg_dump
itself — see app/services/backup.py's module docstring for why) and checks
whether a new scheduled run is due (app/models/backup_schedule.py).
"""

import asyncio
import logging

from app.core.db import AsyncSessionLocal
from app.services.backup import run_pending_and_scheduled_backups

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backup_worker")

# How often to check for a queued manual backup or a due scheduled one —
# independent of the schedule's own daily/weekly cadence. A minute's slop is
# fine for a backup (unlike the violation email worker, nothing here is
# time-critical).
POLL_SECONDS = 60


async def poll_backups() -> None:
    async with AsyncSessionLocal() as db:
        await run_pending_and_scheduled_backups(db)


async def main_loop() -> None:
    logger.info("Backup worker started, polling every %s seconds", POLL_SECONDS)
    while True:
        try:
            await poll_backups()
        except Exception:  # noqa: BLE001 - keep the worker alive across transient errors
            logger.exception("Unhandled error in backup worker loop")
        await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main_loop())
