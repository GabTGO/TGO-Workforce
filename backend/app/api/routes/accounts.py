import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.schemas.account import AccountRead, AccountUpdate
from app.services.activity_log import record_activity

# Every route on this router requires the caller to already be signed in as
# an admin (see app.core.auth.require_admin) — that's what makes this "user
# management" rather than a public account directory. No POST /accounts on
# purpose — accounts are only ever created by the Zoho OAuth callback
# (upsert on zoho_user_id).
router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AccountRead])
async def list_accounts(db: AsyncSession = Depends(get_db)) -> list[Account]:
    result = await db.execute(select(Account).order_by(Account.created_at.desc()))
    return list(result.scalars().all())


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
    # back into user management once the last admin loses that role.
    if account.id == current_admin.id:
        if "role" in changes and changes["role"] != AccountRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can't change your own role away from admin.",
            )
        if changes.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can't deactivate your own account.",
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
