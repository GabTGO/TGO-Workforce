"""Shared helper for creating in-app notifications. Call this from any
endpoint whose action other people should hear about — the same spirit as
app/services/activity_log.py's record_activity(), but for a personal,
dismissable inbox rather than a permanent audit trail. The two are often
called together for the same event (one row per recipient here, one shared
row there); they are not a replacement for each other.
"""

import uuid
from collections.abc import Iterable

from sqlalchemy import ColumnElement, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountRole
from app.models.notification import Notification


async def notify_account(
    db: AsyncSession,
    *,
    account_id: uuid.UUID,
    title: str,
    body: str | None = None,
    link: str | None = None,
    commit: bool = True,
) -> Notification:
    entry = Notification(account_id=account_id, title=title, body=body, link=link)
    db.add(entry)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(entry)
    return entry


async def notify_roles(
    db: AsyncSession,
    roles: Iterable[AccountRole],
    *,
    title: str,
    body: str | None = None,
    link: str | None = None,
    exclude_account_id: uuid.UUID | None = None,
    require_preference: ColumnElement[bool] | None = None,
    commit: bool = True,
) -> list[Notification]:
    """Notifies every active account currently holding one of `roles` — e.g.
    every HR/Admin account when a violation needs review. `exclude_account_id`
    skips the acting account itself, so the person who just did the thing
    that triggered this doesn't also get notified about their own action.
    `require_preference` additionally filters to accounts where that column
    is true — e.g. pass Account.notify_on_violation_review so someone who
    turned that off on the Settings page doesn't get this notification even
    though their role would otherwise qualify."""
    stmt = select(Account.id).where(Account.role.in_(list(roles)), Account.is_active.is_(True))
    if exclude_account_id is not None:
        stmt = stmt.where(Account.id != exclude_account_id)
    if require_preference is not None:
        stmt = stmt.where(require_preference.is_(True))
    result = await db.execute(stmt)
    account_ids = list(result.scalars().all())

    entries = [Notification(account_id=account_id, title=title, body=body, link=link) for account_id in account_ids]
    db.add_all(entries)
    await db.flush()
    if commit:
        await db.commit()
        for entry in entries:
            await db.refresh(entry)
    return entries
