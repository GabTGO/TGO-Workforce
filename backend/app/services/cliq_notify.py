"""Relays a message to a Zoho Cliq channel via an Incoming Webhook, ported
from the standalone onboarding app's app/routers/notify.py.

The frontend builds and previews the exact message text (see
src/lib/onboarding-notify.ts), the person confirms it, and this module just
relays that same string — it never rebuilds or re-derives the message.

One-time setup needed before this works: see backend/.env.example's
CLIQ_WEBHOOK_ENDPOINT/CLIQ_WEBHOOK_TOKEN comment.
"""

import httpx

from app.core.config import get_settings


class CliqNotifyError(Exception):
    """Base class — the caller (app/api/routes/new_hires.py) turns either
    subclass into an HTTP error with this message surfaced verbatim. Split
    into two so "not set up yet" (a config problem) and "Cliq rejected it"
    (a runtime problem, usually a bad/expired token) map to different status
    codes, matching the standalone onboarding app's original behavior."""


class CliqNotConfiguredError(CliqNotifyError):
    pass


class CliqRejectedError(CliqNotifyError):
    pass


async def send_cliq_notification(message: str) -> None:
    settings = get_settings()
    if not settings.cliq_configured:
        raise CliqNotConfiguredError(
            "Cliq webhook isn't configured yet — set CLIQ_WEBHOOK_ENDPOINT and "
            "CLIQ_WEBHOOK_TOKEN on the backend."
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            settings.cliq_webhook_endpoint,
            params={"zapikey": settings.cliq_webhook_token},
            json={"text": message},
            timeout=10,
        )

    if response.status_code >= 400:
        raise CliqRejectedError(f"Cliq rejected the message: {response.text[:300]}")
