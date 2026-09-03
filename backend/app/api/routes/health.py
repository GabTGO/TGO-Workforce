from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness check — does the process respond at all. Used by Railway's healthcheck."""
    return {"status": "ok"}


@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Readiness check — can we actually reach Postgres."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
