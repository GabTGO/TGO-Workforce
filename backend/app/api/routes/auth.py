"""Zoho OAuth login.

/auth/zoho/login   redirects the browser to Zoho to start the flow.
/auth/zoho/callback is where Zoho sends the browser back once the person
                     approves — this exchanges the code, upserts the Account
                     row (matched on Zoho's stable ZUID), and sets the session
                     cookie.
/auth/me           tells the frontend who (if anyone) is currently signed in.
/auth/logout       clears the session cookie.
"""

import secrets
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_account
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.models.account import Account
from app.schemas.account import AccountRead
from app.services import zoho

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/zoho/login")
async def zoho_login(request: Request, settings: Settings = Depends(get_settings)):
    if not settings.zoho_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Zoho sign-in isn't configured yet.",
        )
    # CSRF guard: a random value only this server could have set, checked
    # again against whatever Zoho hands back to the callback below.
    state = secrets.token_urlsafe(24)
    request.session["oauth_state"] = state
    return RedirectResponse(zoho.build_authorize_url(settings, state))


@router.get("/zoho/callback")
async def zoho_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    expected_state = request.session.pop("oauth_state", None)
    failure_redirect = f"{settings.frontend_url}/login?error=zoho"

    if error or not code or not state or state != expected_state:
        return RedirectResponse(failure_redirect)

    try:
        token_payload = await zoho.exchange_code_for_token(settings, code)
        profile = await zoho.fetch_user_info(token_payload["access_token"])
    except (httpx.HTTPError, zoho.ZohoAuthError, KeyError):
        return RedirectResponse(failure_redirect)

    zuid = str(profile.get("ZUID") or "")
    email = profile.get("Email")
    if not zuid or not email:
        return RedirectResponse(failure_redirect)

    result = await db.execute(select(Account).where(Account.zoho_user_id == zuid))
    account = result.scalar_one_or_none()

    now = datetime.now(UTC)
    if account is None:
        # First-ever sign-in for this person — role defaults to VIEWER (see
        # Account.role); an admin promotes them from there. There's no public
        # "create account" endpoint on purpose — this upsert-on-login is the
        # only way a row in accounts ever gets created.
        account = Account(
            zoho_user_id=zuid,
            email=email,
            first_name=profile.get("First_Name"),
            last_name=profile.get("Last_Name"),
            display_name=profile.get("Display_Name"),
            last_login_at=now,
        )
        db.add(account)
    else:
        account.email = email
        account.first_name = profile.get("First_Name")
        account.last_name = profile.get("Last_Name")
        account.display_name = profile.get("Display_Name")
        account.last_login_at = now

    await db.commit()
    await db.refresh(account)

    if not account.is_active:
        return RedirectResponse(f"{settings.frontend_url}/login?error=inactive")

    request.session["account_id"] = str(account.id)
    return RedirectResponse(settings.frontend_url)


@router.get("/me", response_model=AccountRead | None)
async def me(account: Account | None = Depends(get_current_account)):
    return account


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> None:
    request.session.clear()
