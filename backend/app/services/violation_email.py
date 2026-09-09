"""Sends email through the Zoho Mail API — ported from the standalone
attendance app's app/services/zoho_mail.py.

IMPORTANT (carried over from the source app): Zoho's documented behavior is
that `fromAddress` must be "associated to the authenticated account."
Whether an alias/shared mailbox like attendance@tgocorp.com works via the API
the way "Send Mail As" works in the webmail UI is NOT explicitly documented.
Test this against the real Zoho Mail account before relying on it.

This is a DIFFERENT Zoho API client/credential set than app/services/zoho.py
(login OAuth) — see the zoho_mail_* settings in app/core/config.py. Kept as
its own module (rather than folded into app/services/zoho.py) so the
mail-sending scope stays obviously separate from the login scope.
"""

import httpx

from app.core.config import get_settings

settings = get_settings()

ZOHO_ACCOUNTS_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"


class ZohoMailError(Exception):
    pass


async def _get_access_token() -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            ZOHO_ACCOUNTS_TOKEN_URL,
            params={
                "grant_type": "refresh_token",
                "client_id": settings.zoho_mail_client_id,
                "client_secret": settings.zoho_mail_client_secret,
                "refresh_token": settings.zoho_mail_refresh_token,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        if "access_token" not in data:
            raise ZohoMailError(f"Failed to obtain access token: {data}")
        return data["access_token"]


async def send_email(
    *,
    to_address: str,
    subject: str,
    content: str,
    from_address: str | None = None,
    cc_address: str | None = None,
) -> str:
    """Sends the email and returns the Zoho message ID/reference.

    `from_address`/`cc_address` let a caller send with a per-record override
    (see build_from_address()/build_cc_address() in
    violation_email_template.py); omitting them falls back to the configured
    default.

    Raises ZohoMailError on any failure so the caller can mark the record
    Failed and record a readable error. That includes a from_address Zoho
    doesn't recognize as belonging to this account — an override to an
    unvalidated alias fails the same documented way any other Zoho Mail API
    rejection does (see the module docstring above).
    """
    if not settings.zoho_mail_configured:
        raise ZohoMailError(
            "Zoho Mail sending isn't configured yet (zoho_mail_client_id/"
            "zoho_mail_client_secret/zoho_mail_refresh_token)."
        )

    access_token = await _get_access_token()
    url = f"{settings.zoho_mail_api_base_url}/accounts/{settings.zoho_mail_account_id}/messages"

    payload = {
        "fromAddress": from_address or settings.zoho_mail_from_address,
        "toAddress": to_address,
        "ccAddress": cc_address or settings.zoho_mail_from_address,
        "subject": subject,
        "content": content,
        "mailFormat": "html",  # build_body() returns HTML (bold name/labels) — see violation_email_template.py
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Zoho-oauthtoken {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code >= 300:
        raise ZohoMailError(f"Zoho Mail API error {resp.status_code}: {resp.text}")

    data = resp.json()
    try:
        return data["data"]["messageId"]
    except (KeyError, TypeError):
        # Still consider it sent if Zoho returned 2xx, but keep the raw
        # response so a missing messageId doesn't silently disappear.
        return str(data)
