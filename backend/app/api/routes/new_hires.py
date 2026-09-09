"""CRUD for the onboarding checklist tracker (new hire rows), ported from the
standalone tgo-onboarding-app's backend/app/routers/new_hires.py.

Two differences from that source router, both intentional simplifications
for the merged role model:

- No separate audit_logs table / entity-specific audit endpoint — every
  create/update/delete calls record_activity() (app/services/activity_log.py)
  with category=ActivityCategory.ONBOARDING instead, same as every other
  domain in this app. The shared GET /activity-logs?category=onboarding
  endpoint (app/api/routes/activity_logs.py) is what the source app's
  per-entity "/new-hires/{id}/audit-log" route used to be.
- No field-by-field ROLE_FIELD_ACCESS matrix. The source app distinguished
  "recruitment_lead" from "onboarding_specialist" and gated each of the 7
  checklist fields to one or the other; the unified AccountRole enum only has
  a single RECRUITMENT role now, so that distinction no longer exists. Any
  signed-in RECRUITMENT or ADMIN account may edit any field on any row —
  enforced by gating the whole write surface on require_onboarding_writer
  (see app/core/auth.py) rather than re-deriving a per-field matrix that
  wouldn't mean anything anymore.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_account, require_account, require_onboarding_writer
from app.core.db import get_db
from app.models.account import Account
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.new_hire import NewHire
from app.schemas.new_hire import NewHireCreate, NewHireRead, NewHireUpdate
from app.services.activity_log import record_activity

# Router-level dependency: every route here requires a signed-in account
# (401 otherwise). The two read routes (list/get) stop there, so every
# signed-in role — including viewer — can see the tracker. The three write
# routes below additionally depend on require_onboarding_writer, which
# rejects a signed-in non-admin/non-recruitment account with 403.
router = APIRouter(prefix="/onboarding", tags=["onboarding"], dependencies=[Depends(require_account)])

CurrentAccount = Annotated[Account | None, Depends(get_current_account)]
# Guaranteed non-None (require_onboarding_writer 403s otherwise) — used by the
# three write routes below for activity-log attribution and the
# "Completed By" auto-stamp.
WriterAccount = Annotated[Account, Depends(require_onboarding_writer)]


def _actor_label(account: Account) -> str:
    """Same derivation record_activity() uses internally for actor_label —
    duplicated here (rather than imported) because the "Completed By" field
    is a piece of *business data* on the row itself, not just an audit-log
    attribution, so it needs computing independently of whether/how this
    request happens to log an activity entry."""
    return (
        account.display_name
        or f"{account.first_name or ''} {account.last_name or ''}".strip()
        or account.email
    )


def _get_or_404(hire: NewHire | None) -> NewHire:
    if hire is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New hire not found")
    return hire


@router.get("", response_model=list[NewHireRead])
async def list_new_hires(db: Annotated[AsyncSession, Depends(get_db)]) -> list[NewHire]:
    """Backs the onboarding checklist tracker table — every signed-in role
    can view it, same as the Employee Directory's read routes."""
    result = await db.execute(select(NewHire).order_by(NewHire.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{hire_id}", response_model=NewHireRead)
async def get_new_hire(hire_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> NewHire:
    return _get_or_404(await db.get(NewHire, hire_id))


@router.post("", response_model=NewHireRead, status_code=status.HTTP_201_CREATED)
async def create_new_hire(
    payload: NewHireCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> NewHire:
    """Backs the Add New Hire dialog, and is also what the Excel import
    calls once per usable row (there's no separate bulk-import endpoint for
    this smaller dataset, unlike /employees/import)."""
    hire = NewHire(**payload.model_dump())
    # A row can arrive already partway through the checklist — e.g. an Excel
    # import capturing a hire mid-onboarding — so apply the same "Completed
    # By" stamp rule here as the update route below.
    if hire.welcome_email_sent and not hire.completed_by:
        hire.completed_by = _actor_label(account)
    db.add(hire)
    await db.flush()

    await record_activity(
        db,
        action="Created new hire record",
        category=ActivityCategory.ONBOARDING,
        account=account,
        target=hire.name,
        commit=False,
    )
    await db.commit()
    await db.refresh(hire)
    return hire


@router.patch("/{hire_id}", response_model=NewHireRead)
async def update_new_hire(
    hire_id: UUID,
    payload: NewHireUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> NewHire:
    """Backs both the Edit dialog and the inline checklist checkbox toggles —
    a checkbox click is just a one-field PATCH."""
    hire = _get_or_404(await db.get(NewHire, hire_id))

    changes = payload.model_dump(exclude_unset=True)

    # The SOP's "Completed By" rule, carried over from the source app: the
    # first time Welcome Email Sent flips from false to true, stamp it with
    # the acting account's name; after that, never clear or overwrite it
    # again — not even if welcome_email_sent is later unchecked and rechecked.
    if changes.get("welcome_email_sent") and not hire.welcome_email_sent and not hire.completed_by:
        hire.completed_by = _actor_label(account)

    for field, value in changes.items():
        setattr(hire, field, value)
    await db.flush()

    if changes:
        await record_activity(
            db,
            action="Updated new hire record",
            category=ActivityCategory.ONBOARDING,
            account=account,
            target=hire.name,
            details={"changed_fields": list(changes.keys())},
            commit=False,
        )
    await db.commit()
    await db.refresh(hire)
    return hire


@router.delete("/{hire_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_new_hire(
    hire_id: UUID, db: Annotated[AsyncSession, Depends(get_db)], account: WriterAccount
) -> None:
    hire = _get_or_404(await db.get(NewHire, hire_id))

    target = hire.name
    await db.delete(hire)
    await record_activity(
        db,
        action="Removed new hire record",
        category=ActivityCategory.ONBOARDING,
        account=account,
        severity=ActivitySeverity.WARNING,
        target=target,
        commit=False,
    )
    await db.commit()
