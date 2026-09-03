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
# agreed 2026-09-03). Mirrors EMPLOYEE_WRITE_ROLES in src/lib/permissions.ts
# on the frontend — keep the two in sync. Viewer is deliberately excluded:
# read (list/get) and export stay open to every signed-in role, but any
# mutation to the employee roster requires one of these three.
EMPLOYEE_WRITE_ROLES = {AccountRole.ADMIN, AccountRole.PEOPLE_OPS, AccountRole.HUB_LEAD}


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
