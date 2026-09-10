"""App-wide settings a Super Admin controls at runtime — currently whether
sign-in is locked to invited emails only, and whether Attendance Violations
sends via MS Outlook (mailto:) instead of the Zoho Mail API. See
app/models/app_settings.py and app/services/app_settings.py.

GET is open to any signed-in account — the Attendance pages need to know
whether Outlook mode is on to decide how their own Send buttons behave, not
just the Super Admin viewing/editing the toggle on User Management. Only
PATCH is Super Admin-only.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_account, require_super_admin
from app.core.db import get_db
from app.models.account import Account
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.schemas.app_settings import AppSettingsRead, AppSettingsUpdate
from app.services.activity_log import record_activity
from app.services.app_settings import get_app_settings

router = APIRouter(prefix="/app-settings", tags=["app-settings"], dependencies=[Depends(require_account)])

DbSession = Annotated[AsyncSession, Depends(get_db)]
SuperAdmin = Annotated[Account, Depends(require_super_admin)]


@router.get("", response_model=AppSettingsRead)
async def get_settings(db: DbSession) -> AppSettingsRead:
    settings = await get_app_settings(db)
    await db.commit()  # persists the row if get_app_settings just created it
    return AppSettingsRead.model_validate(settings)


@router.patch("", response_model=AppSettingsRead, dependencies=[Depends(require_super_admin)])
async def update_settings(payload: AppSettingsUpdate, db: DbSession, account: SuperAdmin) -> AppSettingsRead:
    settings = await get_app_settings(db)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(settings, field, value)

    if changes:
        await record_activity(
            db,
            action="Updated app settings",
            category=ActivityCategory.ACCESS,
            account=account,
            severity=ActivitySeverity.WARNING,
            details=changes,
            commit=False,
        )
    await db.commit()
    await db.refresh(settings)
    return AppSettingsRead.model_validate(settings)
