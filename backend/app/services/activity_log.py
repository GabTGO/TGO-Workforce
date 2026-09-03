"""Shared helper for writing audit-trail rows.

Call this from any endpoint that changes data (once the Employee endpoints
exist, their create/update/delete handlers call this too) rather than
constructing ActivityLog rows by hand — it's the one place that decides how
actor_label gets derived, so every log entry stays consistent.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.activity_log import ActivityCategory, ActivityLog, ActivitySeverity


async def record_activity(
    db: AsyncSession,
    *,
    action: str,
    category: ActivityCategory,
    account: Account | None = None,
    actor_label: str | None = None,
    target: str | None = None,
    severity: ActivitySeverity = ActivitySeverity.INFO,
    details: dict[str, Any] | None = None,
    commit: bool = True,
) -> ActivityLog:
    """Writes one audit-trail row.

    Pass `account` for a signed-in user's action — actor_label is snapshotted
    from it automatically. Pass `actor_label="System"` (and no account) for
    background jobs or automated actions.
    """
    if actor_label is None:
        if account is None:
            raise ValueError("actor_label is required when account is not provided")
        actor_label = (
            account.display_name
            or f"{account.first_name or ''} {account.last_name or ''}".strip()
            or account.email
        )

    entry = ActivityLog(
        account_id=account.id if account else None,
        actor_label=actor_label,
        action=action,
        target=target,
        category=category,
        severity=severity,
        details=details,
    )
    db.add(entry)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(entry)
    return entry
