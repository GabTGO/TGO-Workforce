import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.account import Account
from app.schemas.account import AccountRead

router = APIRouter(prefix="/accounts", tags=["accounts"])

# No POST /accounts here on purpose — accounts are created by the Zoho OAuth
# callback (upsert on zoho_user_id), once that flow exists. This router is
# read + admin-edit only.


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
