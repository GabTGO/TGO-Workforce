import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.pending_invite import PendingInvite
from app.schemas.account import AccountRead, AccountUpdate
from app.schemas.pending_invite import PendingInviteCreate, PendingInviteRead
from app.services.activity_log import record_activity

# Every route on this router requires the caller to already be signed in as
# an admin (see app.core.auth.require_admin) — that's what makes this "user
# management" rather than a public account directory. No POST /accounts on
# purpose — accounts are only ever created by the Zoho OAuth callback
# (upsert on zoho_user_id). The /accounts/invites routes below are the one
# admin-driven exception: they pre-assign a role to an email before that
# person ever signs in (see app/models/pending_invite.py) rather than
# creating an Account row directly.
router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AccountRead])
async def list_accounts(db: AsyncSession = Depends(get_db)) -> list[Account]:
    result = await db.execute(select(Account).order_by(Account.created_at.desc()))
    return list(result.scalars().all())


# --- Pending invites ---------------------------------------------------------
# Declared before GET/PATCH /{account_id} below: FastAPI/Starlette matches
# routes in declaration order, and "invites" would otherwise get swallowed by
# GET /{account_id} (mistaken for an account_id, which then 422s trying to
# parse "invites" as a UUID) if that route came first.


@router.get("/invites", response_model=list[PendingInviteRead])
async def list_pending_invites(db: AsyncSession = Depends(get_db)) -> list[PendingInvite]:
    result = await db.execute(select(PendingInvite).order_by(PendingInvite.created_at.desc()))
    return list(result.scalars().all())


@router.post("/invites", response_model=PendingInviteRead, status_code=status.HTTP_201_CREATED)
async def create_pending_invite(
    payload: PendingInviteCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: Account = Depends(require_admin),
) -> PendingInvite:
    """Pre-assigns a role to an email that hasn't signed in yet — the next
    Zoho sign-in matching this email gets that role instead of the usual
    VIEWER default (see app/api/routes/auth.py's zoho_callback). Sends no
    email or notification of any kind; the admin still has to tell that
    person out-of-band to go sign in."""
    if payload.role == AccountRole.SUPER_ADMIN and current_admin.role != AccountRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a Super Admin can pre-assign the Super Admin role.",
        )

    email = payload.email.strip().lower()

    existing_account = await db.execute(select(Account).where(Account.email == email))
    if existing_account.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{email} has already signed in — "
                "change their role from the accounts list instead."
            ),
        )

    existing_invite = await db.execute(select(PendingInvite).where(PendingInvite.email == email))
    invite = existing_invite.scalar_one_or_none()
    if invite is not None:
        # Re-inviting an email that's still pending just updates the role
        # rather than erroring — lets an admin fix a typo'd role without a
        # separate delete-then-recreate step.
        invite.role = payload.role
    else:
        invite = PendingInvite(
            email=email,
            role=payload.role,
            invited_by_id=current_admin.id,
            invited_by_label=(
                current_admin.display_name
                or f"{current_admin.first_name or ''} {current_admin.last_name or ''}".strip()
                or current_admin.email
            ),
        )
        db.add(invite)
    await db.flush()

    await record_activity(
        db,
        action="Invited user",
        category=ActivityCategory.ACCESS,
        account=current_admin,
        target=email,
        details={"role": payload.role.value},
        commit=False,
    )
    await db.commit()
    await db.refresh(invite)
    return invite


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_pending_invite(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: Account = Depends(require_admin),
) -> None:
    invite = await db.get(PendingInvite, invite_id)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    email = invite.email
    await db.delete(invite)
    await record_activity(
        db,
        action="Revoked invite",
        category=ActivityCategory.ACCESS,
        account=current_admin,
        target=email,
        commit=False,
    )
    await db.commit()


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Account:
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: Account = Depends(require_admin),
) -> Account:
    """Backs the User Management page — the only way an account's role or
    active state ever changes after its first Zoho sign-in."""
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    changes = payload.model_dump(exclude_unset=True)

    # Guard against an admin locking themselves out — there's no other way
    # back into user management once the last admin loses that role. Covers
    # both full-access roles (a Super Admin keeping their own row at
    # super_admin is just as valid as an admin keeping theirs at admin).
    if account.id == current_admin.id:
        if "role" in changes and changes["role"] not in (AccountRole.ADMIN, AccountRole.SUPER_ADMIN):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can't change your own role away from admin.",
            )
        if changes.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can't deactivate your own account.",
            )

    # Only a Super Admin can grant or take away the Super Admin role itself —
    # otherwise a regular Admin could hand matrix-editing power to any account
    # (including a second account they control), bypassing the whole point of
    # having a role "above Admin" that alone can reconfigure the permission
    # matrix (see app/services/permissions.py).
    if "role" in changes and current_admin.role != AccountRole.SUPER_ADMIN:
        if changes["role"] == AccountRole.SUPER_ADMIN or account.role == AccountRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only a Super Admin can grant or change the Super Admin role.",
            )

    for field, value in changes.items():
        setattr(account, field, value)
    await db.flush()

    if changes:
        await record_activity(
            db,
            action="Updated account",
            category=ActivityCategory.ACCESS,
            account=current_admin,
            target=account.email,
            details={"changed_fields": list(changes.keys())},
            severity=(
                ActivitySeverity.WARNING
                if "role" in changes or "is_active" in changes
                else ActivitySeverity.INFO
            ),
            commit=False,
        )
    await db.commit()
    await db.refresh(account)
    return account
