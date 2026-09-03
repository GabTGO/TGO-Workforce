"""Thin client for the pieces of Zoho OAuth this app needs: building the
authorize URL, exchanging an auth code for a token, and fetching the signed-in
user's profile. Kept separate from the route module so the HTTP-calling logic
is easy to find — and easy to swap out for a fake in tests.

Docs: https://www.zoho.com/accounts/protocol/oauth.html
"""

from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import Settings

AUTHORIZE_URL = "https://accounts.zoho.com/oauth/v2/auth"
TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"
USERINFO_URL = "https://accounts.zoho.com/oauth/user/info"

# AaaServer.profile.READ is the minimal Zoho scope for "who is this person" —
# email, name, ZUID. It does not grant access to Mail/CRM/any other Zoho data.
SCOPE = "AaaServer.profile.READ"


class ZohoAuthError(Exception):
    """Raised when Zoho's token endpoint reports an error (bad/expired code, etc.)."""


def build_authorize_url(settings: Settings, state: str) -> str:
    params = {
        "client_id": settings.zoho_client_id,
        "response_type": "code",
        "redirect_uri": settings.zoho_redirect_uri,
        "scope": SCOPE,
        "access_type": "online",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code_for_token(settings: Settings, code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.zoho_client_id,
                "client_secret": settings.zoho_client_secret,
                "redirect_uri": settings.zoho_redirect_uri,
                "code": code,
            },
        )
    response.raise_for_status()
    payload = response.json()
    if "access_token" not in payload:
        raise ZohoAuthError(payload.get("error", "unknown_error"))
    return payload


async def fetch_user_info(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
        )
    response.raise_for_status()
    return response.json()
