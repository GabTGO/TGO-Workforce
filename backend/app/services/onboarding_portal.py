"""Read-only client for the separate Onboarding/Offboarding portal's external
New Hires API, which backs this app's own New Hires page (see
app/api/routes/new_hires_portal.py). Mirrors app/services/cliq_notify.py's
shape (a settings-driven "configured" guard, a dedicated error type) even
though this call is a GET, not a POST — same reasoning: fail with a clear,
catchable error before ever making the request if the integration hasn't
been set up yet.

Auth is a plain `x-api-key` header — confirmed against the live API
(Authorization: Bearer returns 401 there, x-api-key returns 200).
"""

import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import get_settings


class OnboardingPortalNotConfiguredError(Exception):
    pass


class PortalNewHire(BaseModel):
    """The portal's own JSON shape, passed straight through — this isn't one
    of our own DB rows, so there's no snake_case backend / camelCase
    frontend translation layer here, just re-serializing the same camelCase
    keys the portal sent."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    company_id: str | None = Field(default=None, alias="companyId")
    name: str
    email: str
    phone: str
    position: str
    department: str
    start_date: str = Field(alias="startDate")
    status: str
    manager: str | None = None
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


async def fetch_portal_new_hires(
    status: str | None = None,
    updated_since: str | None = None,
) -> list[PortalNewHire]:
    settings = get_settings()
    if not settings.onboarding_portal_configured:
        raise OnboardingPortalNotConfiguredError(
            "The onboarding portal integration isn't configured yet — set "
            "ONBOARDING_PORTAL_BASE_URL and ONBOARDING_PORTAL_API_KEY on the backend."
        )

    params: dict[str, str] = {}
    if status:
        params["status"] = status
    if updated_since:
        params["updatedSince"] = updated_since

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.onboarding_portal_base_url}/api/external/new-hires",
            headers={"x-api-key": settings.onboarding_portal_api_key},
            params=params,
            timeout=10,
        )
    response.raise_for_status()

    body = response.json()
    return [PortalNewHire.model_validate(row) for row in body.get("newHires", [])]
