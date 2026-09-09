"""The signed-in account's own notification inbox — backs the nav bell icon
and its dropdown. Always scoped to the caller (there's no "list anyone's
notifications" route, admin or otherwise — a notification is only ever
meaningful to the account it was created for).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_account
from app.core.db import get_db
from app.models.account import Account
from app.models.notification import Notification
from app.schemas.notification import NotificationRead, UnreadCount

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(require_account)])

CurrentAccount = Annotated[Account, Depends(require_account)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    account: CurrentAccount,
    db: DbSession,
    unread_only: bool = False,
    limit: Annotated[int, Query(le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Notification]:
    stmt = select(Notification).where(Notification.account_id == account.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(account: CurrentAccount, db: DbSession) -> UnreadCount:
    """Lightweight poll target for the bell's badge — just a count, not the
    full list, so polling this every 15s doesn't refetch the whole inbox."""
    stmt = select(func.count()).select_from(Notification).where(
        Notification.account_id == account.id, Notification.is_read.is_(False)
    )
    count = (await db.execute(stmt)).scalar_one()
    return UnreadCount(count=count)


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(notification_id: int, account: CurrentAccount, db: DbSession) -> Notification:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.account_id != account.id:
        # Same 404 either way — a notification that isn't yours shouldn't
        # even confirm it exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(account: CurrentAccount, db: DbSession) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.account_id == account.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
