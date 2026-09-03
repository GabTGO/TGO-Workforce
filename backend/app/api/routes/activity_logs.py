from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_account
from app.core.db import get_db
from app.models.activity_log import ActivityCategory, ActivityLog, ActivitySeverity
from app.schemas.activity_log import ActivityLogRead

# Requires a signed-in account — this used to be reachable by anyone.
router = APIRouter(
    prefix="/activity-logs", tags=["activity-logs"], dependencies=[Depends(require_account)]
)


@router.get("", response_model=list[ActivityLogRead])
async def list_activity_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: ActivityCategory | None = None,
    severity: ActivitySeverity | None = None,
    limit: Annotated[int, Query(le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ActivityLog]:
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc())
    if category is not None:
        stmt = stmt.where(ActivityLog.category == category)
    if severity is not None:
        stmt = stmt.where(ActivityLog.severity == severity)
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())
