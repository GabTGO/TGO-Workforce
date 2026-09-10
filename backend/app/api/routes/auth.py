"""Zoho OAuth login.

/auth/zoho/login   redirects the browser to Zoho to start the flow.
/auth/zoho/callback is where Zoho sends the browser back once the person
                     approves — this exchanges the code, upserts the Account
                     row (matched on Zoho's stable ZUID), and sets the session
                     cookie. A brand-new account's role comes from a matching
                     PendingInvite (see app/models/pending_invite.py) if an
                     admin registered one via POST /accounts/invites, or the
                     usual VIEWER default otherwise — unless invite-only
                     sign-in is on (see app/models/app_settings.py), in which
                     case a brand-new account with no invite is rejected.
/auth/me           tells the frontend who (if anyone) is currently signed in.
/auth/me/preferences lets that same person update their own personalization
                     (theme, default office, notification toggles) — see
                     AccountPreferencesUpdate. Nothing here needs admin rights;
                     it's always "change my own preferences", never someone
                     else's (that's PATCH /accounts/{id}, admin-only).
/auth/sandbox/enter and /exit let a genuine Super Admin temporarily act as one
                     of the six matrix-configurable roles — a *live* switch
                     (see app/core/auth.py's get_effective_role), not just a
                     UI preview, so they can actually prove the permission
                     matrix works end to end.
/auth/logout       clears the session cookie.
"""

import secrets
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SANDBOX_SESSION_KEY, get_current_account, get_effective_role, require_account
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.pending_invite import PendingInvite
from app.schemas.account import AccountPreferencesUpdate, AccountRead, SandboxRoleRequest
from app.services import zoho
from app.services.activity_log import record_activity
from app.services.app_settings import get_app_settings
from app.services.permissions import MATRIX_ROLES, get_account_permissions

router = APIRouter(prefix="/auth", tags=["auth"])


async def _account_read(db: AsyncSession, account: Account, request: Request) -> AccountRead:
    """Shared builder for every response that hands the signed-in caller back
    their own account — /auth/me, /auth/me/preferences, and both sandbox
    endpoints. Computes `permissions` from the *effective* role (real role,
    unless a Super Admin has an active sandbox override) and surfaces that
    override as `sandbox_role` so the frontend can bannner it, while `role`
    itself always stays the real persisted value."""
    role = get_effective_role(account, request)
    permissions = await get_account_permissions(db, account, role=role)
    account_read = AccountRead.model_validate(account)
    account_read.permissions = sorted(permissions, key=lambda p: p.value)
    account_read.sandbox_role = role if role != account.role else None
    return account_read


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
        # First-ever sign-in for this person. There's no public "create
        # account" endpoint on purpose — this upsert-on-login is the only way
        # a row in accounts ever gets created — but an admin can pre-assign a
        # role for this email via POST /accounts/invites before they ever
        # sign in (see app/models/pending_invite.py); consume that here if
        # one's waiting, otherwise fall back to the usual VIEWER default.
        invite_result = await db.execute(
            select(PendingInvite).where(PendingInvite.email == email.lower())
        )
        pending_invite = invite_result.scalar_one_or_none()

        # A Super Admin can lock the portal down to invited emails only (see
        # app/models/app_settings.py) — the standing admin allowlist still
        # bootstraps in regardless, since that's the one way in without any
        # database access at all if every invite were somehow lost.
        if pending_invite is None and email.lower() not in settings.admin_email_set:
            app_settings = await get_app_settings(db)
            if app_settings.invite_only_signup:
                await db.commit()  # persist the get-or-create'd settings row, if it was just created
                return RedirectResponse(f"{settings.frontend_url}/login?error=invite_only")

        account = Account(
            zoho_user_id=zuid,
            email=email,
            first_name=profile.get("First_Name"),
            last_name=profile.get("Last_Name"),
            display_name=profile.get("Display_Name"),
            role=pending_invite.role if pending_invite else AccountRole.VIEWER,
            last_login_at=now,
        )
        db.add(account)
        if pending_invite is not None:
            await db.delete(pending_invite)
    else:
        account.email = email
        account.first_name = profile.get("First_Name")
        account.last_name = profile.get("Last_Name")
        # display_name is deliberately NOT re-synced here — Zoho's profile
        # only *seeds* it once, on first-ever sign-in (the `if account is
        # None` branch above). Once someone's account exists, display_name
        # is theirs to customize (see PATCH /auth/me/preferences and the
        # Profile page) — re-syncing it on every login would silently
        # overwrite that self-edit the next time they signed in.
        account.last_login_at = now

    # Bootstrap / standing admin allowlist — see Settings.zoho_admin_emails.
    # Applied on every login (not just account creation) so adding an email
    # to the list and having that person sign in again is enough to promote
    # them, with no database access required.
    if email.lower() in settings.admin_email_set:
        account.role = AccountRole.ADMIN

    await db.commit()
    await db.refresh(account)

    if not account.is_active:
        return RedirectResponse(f"{settings.frontend_url}/login?error=inactive")

    request.session["account_id"] = str(account.id)
    return RedirectResponse(settings.frontend_url)


@router.get("/me", response_model=AccountRead | None)
async def me(
    request: Request,
    account: Account | None = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    if account is None:
        return None
    return await _account_read(db, account, request)


@router.patch("/me/preferences", response_model=AccountRead)
async def update_my_preferences(
    payload: AccountPreferencesUpdate,
    request: Request,
    account: Account = Depends(require_account),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    """Backs the Profile and Settings pages' personalization controls (theme,
    default office, notification toggles). Deliberately not routed through
    the admin-only /accounts router — anyone signed in can change their own
    preferences, same as they could always toggle their own theme."""
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(account, field, value)
    if changes:
        await db.commit()
        await db.refresh(account)
    return await _account_read(db, account, request)


@router.post("/sandbox/enter", response_model=AccountRead)
async def enter_sandbox(
    payload: SandboxRoleRequest,
    request: Request,
    account: Account = Depends(require_account),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    """Temporarily switches the caller's *effective* role for this session to
    one of the six matrix-configurable roles — every permission check from
    here on (nav, pages, every write endpoint) enforces exactly what that
    role can do, until /auth/sandbox/exit is called. Deliberately checks the
    real account.role directly rather than going through require_super_admin
    (which would use the *effective* role) — a Super Admin sandboxing as
    Viewer must still be able to reach this endpoint's sibling, /exit, to get
    back."""
    if account.role != AccountRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a Super Admin can sandbox a role")
    if payload.role not in MATRIX_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only sandbox one of the configurable roles",
        )
    request.session[SANDBOX_SESSION_KEY] = payload.role.value
    await record_activity(
        db,
        action=f"Entered sandbox as {payload.role.value}",
        category=ActivityCategory.ACCESS,
        account=account,
        severity=ActivitySeverity.WARNING,
        commit=True,
    )
    return await _account_read(db, account, request)


@router.post("/sandbox/exit", response_model=AccountRead)
async def exit_sandbox(
    request: Request,
    account: Account = Depends(require_account),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    had_sandbox = request.session.pop(SANDBOX_SESSION_KEY, None)
    if had_sandbox:
        await record_activity(
            db,
            action="Exited sandbox",
            category=ActivityCategory.ACCESS,
            account=account,
            severity=ActivitySeverity.INFO,
            commit=True,
        )
    return await _account_read(db, account, request)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> None:
    request.session.clear()
