"""Session-backed auth, wired to the Zoho OAuth login flow.

The session itself is a signed, httpOnly cookie (Starlette's SessionMiddleware,
added in app/main.py) holding nothing but the account id — no secrets, and it
can't be read or tampered with from JavaScript. get_current_account() resolves
that id to a live Account row (or None if there's no session, the account was
deleted, or it's been deactivated). require_account() is the same check for
routes that should outright reject a signed-out request instead of treating
it as "acting as System" (see app/api/routes/employees.py for that pattern).
"""

import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.account import Account, AccountRole


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
    return account


async def require_account(
    account: Account | None = Depends(get_current_account),
) -> Account:
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return account


async def require_admin(
    account: Account = Depends(require_account),
) -> Account:
    """Same as require_account, but also rejects a signed-in non-admin with
    403. Used to gate /accounts (user management) and anything else that
    should only ever be reachable by an admin."""
    if account.role != AccountRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return account


# Roles allowed to create/edit/delete/import employee records (RBAC policy
# tightened to one-role-per-module 2026-09-09: each non-admin role now owns
# exactly one module — People Ops owns Employee Directory, HR + Projects
# split Attendance by action (see ATTENDANCE_WRITE_ROLES/ATTENDANCE_APPROVE_ROLES
# below), Recruitment Lead + Onboarding Specialist split Onboarding by
# checklist field (see ROLE_FIELD_ACCESS below) — only Admin crosses modules.
# Mirrors EMPLOYEE_WRITE_ROLES in src/lib/permissions.ts on the frontend —
# keep the two in sync. Viewer is deliberately excluded: read (list/get) and
# export stay open to every signed-in role, but any mutation to the employee
# roster requires one of these two.
EMPLOYEE_WRITE_ROLES = {AccountRole.ADMIN, AccountRole.PEOPLE_OPS}


async def require_employee_writer(
    account: Account = Depends(require_account),
) -> Account:
    """Same as require_account, but also rejects a signed-in viewer with 403.
    Used to gate the write routes in app/api/routes/employees.py (create,
    update, delete, bulk-delete, import) — the read routes stay on plain
    require_account so viewers can still search/filter/export."""
    if account.role not in EMPLOYEE_WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify employee records",
        )
    return account


# Roles allowed to touch the onboarding checklist at all (new hires tracker,
# ported from the standalone onboarding app). This is the broad "reaches this
# router" check — Recruitment Lead and Onboarding Specialist are further
# restricted to their own checklist fields by ROLE_FIELD_ACCESS in
# app/api/routes/new_hires.py (per the New Hire Onboarding Tracker SOP), not
# by this constant. Mirrors ONBOARDING_WRITE_ROLES in src/lib/permissions.ts
# — keep the two in sync.
ONBOARDING_WRITE_ROLES = {
    AccountRole.ADMIN,
    AccountRole.RECRUITMENT_LEAD,
    AccountRole.ONBOARDING_SPECIALIST,
}


async def require_onboarding_writer(
    account: Account = Depends(require_account),
) -> Account:
    if account.role not in ONBOARDING_WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify onboarding records",
        )
    return account


# --- TEMPORARY: Attendance Violations is still in progress -----------------
# While this module is being built and tested, every write/approve/delete
# action is restricted to a single developer account regardless of role —
# everyone else can still view records (read routes stay on plain
# require_account, untouched by this), but any attempt to create, edit,
# prepare, approve, hold, send, import, or delete gets this message instead.
# To lift the restriction once the module is ready for general HR/Projects
# use: delete this constant, this function, and its call sites below
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


# Roles allowed to create/edit/prepare/import attendance violation records —
# per the SOP's section 17 ("Projects Team" builds/submits) and section 3's
# workflow (someone adds/updates the tracker row and moves it to Ready to
# Prepare; that doesn't have to be HR itself). Both HR and Projects can reach
# this far; only HR (+Admin) can actually approve/send — see
# ATTENDANCE_APPROVE_ROLES below. Mirrors ATTENDANCE_WRITE_ROLES in
# src/lib/permissions.ts.
ATTENDANCE_WRITE_ROLES = {AccountRole.ADMIN, AccountRole.HR, AccountRole.PROJECTS}

# Narrower than ATTENDANCE_WRITE_ROLES: only HR (+Admin) may approve/hold/
# needs-correction/resend/send a violation record — the SOP is explicit
# (section 10): "The system must never send a newly prepared attendance
# violation email without an explicit HR approval status." Projects can
# prepare a record but never approve its own submission. Mirrors
# ATTENDANCE_APPROVE_ROLES in src/lib/permissions.ts.
ATTENDANCE_APPROVE_ROLES = {AccountRole.ADMIN, AccountRole.HR}


async def require_violation_writer(
    account: Account = Depends(require_account),
) -> Account:
    _require_attendance_in_progress_dev(account)
    if account.role not in ATTENDANCE_WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify attendance violation records",
        )
    return account


async def require_violation_approver(
    account: Account = Depends(require_account),
) -> Account:
    _require_attendance_in_progress_dev(account)
    if account.role not in ATTENDANCE_APPROVE_ROLES:
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
