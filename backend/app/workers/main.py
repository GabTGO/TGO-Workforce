"""Combined worker process entrypoint — runs the violation email send loop
and the scheduled database backup loop concurrently in one process/service
(see Dockerfile.worker's CMD). Both are lightweight, infrequent polling
loops; running them together means Railway only needs one extra always-on
service for background jobs, not one per job. Either loop's own module still
works standalone (each has its own `if __name__ == "__main__"`) for local
debugging of just one of them.
"""

import asyncio

from app.workers.backup_worker import main_loop as backup_loop
from app.workers.violation_email_worker import main_loop as violation_email_loop


async def main() -> None:
    await asyncio.gather(violation_email_loop(), backup_loop())


if __name__ == "__main__":
    asyncio.run(main())
