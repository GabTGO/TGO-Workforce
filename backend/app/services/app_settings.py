"""Get-or-create accessor for the singleton AppSettings row (id=1) — every
reader and writer goes through this instead of querying the table directly,
so nothing has to worry about the row not existing yet (a fresh database
before the seeding migration ever ran, or a test database that skips
migrations entirely, same reasoning as DEFAULT_GRANTS in permissions.py).
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_settings import AppSettings

SETTINGS_ID = 1


async def get_app_settings(db: AsyncSession) -> AppSettings:
    settings = await db.get(AppSettings, SETTINGS_ID)
    if settings is not None:
        return settings

    settings = AppSettings(id=SETTINGS_ID)
    db.add(settings)
    try:
        await db.flush()
    except IntegrityError:
        # Lost a race with another request creating the same singleton row —
        # roll back this attempt and read back whatever won.
        await db.rollback()
        settings = await db.get(AppSettings, SETTINGS_ID)
        assert settings is not None
    return settings
