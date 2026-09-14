"""Session-backed auth, wired to the Zoho OAuth login flow.

The session itself is a signed, httpOnly cookie (Starlette's SessionMiddleware,
added in app/main.py) holding the account id plus (since the "active
sessions" feature — see app/models/session.py) a session id. get_current_account()
resolves the account id to a live Account row (or None if there's no
session, the account was deleted, or it's been deactivated), and — when a
session id is also present — checks it against AccountSession for
revocation, so a Super Admin's POST /accounts/sessions/{id}/terminate takes
effect on that browser's very next request. require_account() is the same
check for routes that should outright reject a signed-out request instead of
treating it as "acting as System" (see app/api/routes/employees.py for that
pattern).

Module-level access (can this role see/use Onboarding at all, etc.) is
governed by the dynamic permission matrix — see require_permission() below
and app/services/permissions.py. Admin and Super Admin bypass it entirely.
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.permission import Permission
from app.models.session import AccountSession
from app.services.permissions import PERMISSION_LABELS, has_permission

# How stale last_seen_at has to be before a request bothers updating it — a
# write on literally every authenticated request (this app polls several
# endpoints every 15s while a tab is open) would be wasteful; this still
# keeps "Active now" accurate to within a minute, which is plenty for a
# presence indicator.
SESSION_LAST_SEEN_THROTTLE = timedelta(seconds=60)

# Session key for a Super Admin's active "sandbox" — see /auth/sandbox/enter
# and /auth/sandbox/exit in app/api/routes/auth.py. Only ever consulted for
# an account whose *real* role is SUPER_ADMIN (see get_effective_role below),
# so this can't be used to smuggle in extra access for anyone else even if a
# session somehow carried a stale value.
SANDBOX_SESSION_KEY = "sandbox_role"


def get_effective_role(account: Account, request: Request) -> AccountRole:
    """The role every permission check in this module actually uses — the
    real persisted account.role, unless account is a genuine Super Admin
    with an active sandbox override in their session. This is a *live* role
    switch (not just a UI preview): every dependency below enforces exactly
    what the sandboxed role could do, including losing admin/super-admin
    access — that's the point, it's how a Super Admin proves the matrix
    really works instead of just how it looks. See /auth/sandbox/enter."""
    if account.role != AccountRole.SUPER_ADMIN:
        return account.role
    raw = request.session.get(SANDBOX_SESSION_KEY)
    if not raw:
        return account.role
    try:
        return AccountRole(raw)
    except ValueError:
        return account.role


async def get_current_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Account | None:
    raw_id = request.session.get("account_id")
    if not raw_id:
        return None
    try:
        account_id = uuid.UUID(raw_id)
    except ValueError:
        return None
    account = await db.get(Account, account_id)
    if account is None or not account.is_active:
        return None

    # A cookie set before the "active sessions" feature shipped has no
    # session_id in it at all — skip the revocation check entirely for those
    # rather than treating a missing id as "revoked" (that would force-log-out
    # every already-signed-in person the moment this deploys).
    raw_session_id = request.session.get("session_id")
    if raw_session_id:
        try:
            session_id = uuid.UUID(raw_session_id)
        except ValueError:
            session_id = None
        if session_id is not None:
            account_session = await db.get(AccountSession, session_id)
            if account_session is None or account_session.revoked_at is not None:
                return None
            now = datetime.now(UTC)
            if now - account_session.last_seen_at >= SESSION_LAST_SEEN_THROTTLE:
                account_session.last_seen_at = now
                await db.commit()

    return account


async def require_account(
    account: Account | None = Depends(get_current_account),
) -> Account:
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return account


async def require_admin(
    account: Account = Depends(require_account),
    request: Request = None,  # type: ignore[assignment]
) -> Account:
    """Same as require_account, but also rejects anyone who isn't Admin or
    Super Admin with 403 — and anyone whose account is restricted
    (Account.is_restricted), regardless of role. Used to gate /accounts
    (user management) and anything else that should only ever be reachable
    by one of those two — Super Admin has every Admin capability plus
    permission-matrix editing (require_super_admin below), it's never a
    *narrower* role than Admin. Uses the effective role (real role, unless
    sandboxed — see get_effective_role), so a Super Admin sandboxing as a
    non-admin role genuinely loses this access too."""
    if account.is_restricted or get_effective_role(account, request) not in (
        AccountRole.ADMIN,
        AccountRole.SUPER_ADMIN,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return account


async def require_super_admin(
    account: Account = Depends(require_account),
    request: Request = None,  # type: ignore[assignment]
) -> Account:
    """Gates the permission-matrix endpoints only (GET/PUT
    app/api/routes/permissions.py) — deliberately narrower than require_admin.
    A regular Admin has full access to every module already; reconfiguring
    *what every other role* is allowed to do is Super Admin's alone. Uses the
    effective role, same as require_admin — deliberately NOT used to gate
    /auth/sandbox/enter or /exit themselves, which always check the real
    account.role directly so a sandboxed Super Admin can always get back."""
    if account.is_restricted or get_effective_role(account, request) != AccountRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")
    return account


def require_permission(
    permission: Permission,
) -> Callable[[Account, AsyncSession, Request], Awaitable[Account]]:
    """Dependency factory: Depends(require_permission(Permission.X)) rejects
    with 403 any signed-in account whose *effective* role doesn't currently
    hold that permission (Admin/Super Admin always pass — see
    FULL_ACCESS_ROLES in app/services/permissions.py; a restricted account
    never passes for anything but a view permission, regardless of role).
    Use this instead of hardcoding a role set inline, so a Super Admin's
    matrix edit — or sandbox switch — actually takes effect everywhere that
    permission is checked."""

    async def _dependency(
        account: Account = Depends(require_account),
        db: AsyncSession = Depends(get_db),
        request: Request = None,  # type: ignore[assignment]
    ) -> Account:
        role = get_effective_role(account, request)
        if not await has_permission(db, account, permission, role=role):
            title = PERMISSION_LABELS[permission]["title"]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have the '{title}' permission",
            )
        return account

    return _dependency


# Mirrors EMPLOYEE_WRITE_ROLES in src/lib/permissions.ts (kept as a name
# there for the frontend's own gating, though the source of truth for what
# it actually means now lives in the database, not a hardcoded role set).
require_employee_writer = require_permission(Permission.EMPLOYEES_MANAGE)

# Mirrors ONBOARDING_WRITE_ROLES in src/lib/permissions.ts. This is the broad
# "may touch the onboarding module at all" check — Recruitment Lead and
# Onboarding Specialist are further restricted to their own checklist fields
# by ROLE_FIELD_ACCESS in app/api/routes/new_hires.py (per the New Hire
# Onboarding Tracker SOP), which stays fixed in code regardless of what the
# matrix says — the matrix only decides whether a role reaches this far at all.
require_onboarding_writer = require_permission(Permission.ONBOARDING_MANAGE)


# --- TEMPORARY: Attendance Violations is still in progress -----------------
# While this module is being built and tested, every write/approve/delete
# action is restricted to a single developer account regardless of role —
# everyone else can still view records (the plain view-permission dependency
# below is untouched by this), but any attempt to create, edit, prepare,
# approve, hold, send, import, or delete gets this message instead. To lift
# the restriction once the module is ready for general HR/Projects use:
# delete this constant, this function, and its three call sites below
# (require_violation_writer, require_violation_approver, require_violation_admin).
ATTENDANCE_DEV_ONLY_EMAIL = "gabriel.battung@tgocorp.com"


def _require_attendance_in_progress_dev(account: Account) -> None:
    if account.email.lower() != ATTENDANCE_DEV_ONLY_EMAIL.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Attendance Violations is still in progress — only the developer "
                "account is authorized to do that right now."
            ),
        )


async def require_violation_writer(
    account: Account = Depends(require_account),
    db: AsyncSession = Depends(get_db),
    request: Request = None,  # type: ignore[assignment]
) -> Account:
    """Create/edit/prepare/import a violation record — per the SOP's section
    17 ("Projects Team" builds/submits) and section 3's workflow (someone
    adds/updates the tracker row; that doesn't have to be HR itself). Gated
    on Permission.ATTENDANCE_MANAGE (matrix-configurable — HR and Projects
    both hold it by default); only HR can actually approve/send — see
    require_violation_approver below. Also temporarily dev-only — see above."""
    _require_attendance_in_progress_dev(account)
    role = get_effective_role(account, request)
    if not await has_permission(db, account, Permission.ATTENDANCE_MANAGE, role=role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify attendance violation records",
        )
    return account


async def require_violation_approver(
    account: Account = Depends(require_account),
    db: AsyncSession = Depends(get_db),
    request: Request = None,  # type: ignore[assignment]
) -> Account:
    """Approve/hold/needs-correction/resend/send a violation record. The SOP
    is explicit (section 10): "The system must never send a newly prepared
    attendance violation email without an explicit HR approval status."
    Gated on Permission.ATTENDANCE_APPROVE (matrix-configurable — only HR
    holds it by default; Projects can prepare a record but never approve its
    own submission). Also temporarily dev-only — see above."""
    _require_attendance_in_progress_dev(account)
    role = get_effective_role(account, request)
    if not await has_permission(db, account, Permission.ATTENDANCE_APPROVE, role=role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to approve, hold, or send attendance violation records",
        )
    return account


async def require_violation_admin(
    account: Account = Depends(require_admin),
) -> Account:
    """Same as require_admin, plus the temporary in-progress gate above — used
    in place of plain require_admin for violations.py's hard-delete routes
    only, so this module-specific restriction doesn't leak into /accounts or
    any other admin-only route that also depends on require_admin."""
    _require_attendance_in_progress_dev(account)
    return account
