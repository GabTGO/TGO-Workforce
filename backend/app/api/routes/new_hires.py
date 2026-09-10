"""CRUD for the onboarding checklist tracker (new hire rows), ported from the
standalone tgo-onboarding-app's backend/app/routers/new_hires.py.

Field-level role split (corrected 2026-09-09 against the New Hire Onboarding
Tracker SOP): Recruitment Lead and Onboarding Specialist are two distinct
roles, not one merged role — see ROLE_FIELD_ACCESS below for the exact
per-field write matrix, which mirrors the SOP's protected-range design
(Recruitment Leads write F:G [items 1-2], Onboarding Specialist writes J:M
[items 4-7], H [item 3, Welcome Email Sent] is writable by either since it
depends on whichever person is available first).

One difference from the source app: no separate audit_logs table /
entity-specific audit endpoint — every create/update/delete calls
record_activity() (app/services/activity_log.py) with
category=ActivityCategory.ONBOARDING instead, same as every other domain in
this app. The shared GET /activity-logs?category=onboarding endpoint
(app/api/routes/activity_logs.py) is what the source app's per-entity
"/new-hires/{id}/audit-log" route used to be.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_account,
    require_onboarding_writer,
    require_permission,
)
from app.core.db import get_db
from app.models.account import Account, AccountRole
from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.models.new_hire import NewHire
from app.models.permission import Permission
from app.schemas.new_hire import CliqNotifyRequest, NewHireCreate, NewHireRead, NewHireUpdate
from app.services.activity_log import record_activity
from app.services.cliq_notify import (
    CliqNotConfiguredError,
    CliqRejectedError,
    send_cliq_notification,
)
from app.services.notify import notify_permission_holders

# Router-level dependency: every route here requires Permission.ONBOARDING_VIEW
# (matrix-configurable — Admin/Super Admin always have it; Recruitment Lead
# and Onboarding Specialist hold it by default). The two read routes
# (list/get) stop there. The three write routes below additionally depend on
# require_onboarding_writer (Permission.ONBOARDING_MANAGE), which
# update_new_hire further restricts *which fields* within a request are
# allowed via the fixed ROLE_FIELD_ACCESS matrix below (that split is
# SOP-mandated, not matrix-configurable).
router = APIRouter(
    prefix="/onboarding",
    tags=["onboarding"],
    dependencies=[Depends(require_permission(Permission.ONBOARDING_VIEW))],
)

CurrentAccount = Annotated[Account | None, Depends(get_current_account)]
# Guaranteed non-None (require_onboarding_writer 403s otherwise) — used by the
# three write routes below for activity-log attribution and the
# "Completed By" auto-stamp.
WriterAccount = Annotated[Account, Depends(require_onboarding_writer)]

# Which roles may change each checklist field — the SOP's protected-range
# split (section 3, "Roles & Responsibilities"): Recruitment Lead owns items
# 1-2, Onboarding Specialist owns items 4-7, item 3 (Welcome Email Sent) is
# shared since it depends on whichever person is available first. Fields not
# listed here (name, role_title, start_date, recruitment_lead,
# onboarding_specialist name-assignment, completed_by) stay open to any
# onboarding role — they're not part of the SOP's protected-range table.
ROLE_FIELD_ACCESS: dict[str, set[AccountRole]] = {
    "jo_discussion": {AccountRole.RECRUITMENT_LEAD, AccountRole.ADMIN},
    "confirmation_signed": {AccountRole.RECRUITMENT_LEAD, AccountRole.ADMIN},
    "welcome_email_sent": {
        AccountRole.RECRUITMENT_LEAD,
        AccountRole.ONBOARDING_SPECIALIST,
        AccountRole.ADMIN,
    },
    "new_hire_info": {AccountRole.ONBOARDING_SPECIALIST, AccountRole.ADMIN},
    "id_photo": {AccountRole.ONBOARDING_SPECIALIST, AccountRole.ADMIN},
    "credentials_created": {AccountRole.ONBOARDING_SPECIALIST, AccountRole.ADMIN},
    "onboarding_day": {AccountRole.ONBOARDING_SPECIALIST, AccountRole.ADMIN},
}

FIELD_LABELS = {
    "jo_discussion": "JO Discussion",
    "confirmation_signed": "Confirmation Sheet Signed",
    "welcome_email_sent": "Welcome Email Sent",
    "new_hire_info": "New Hire Info Completed",
    "id_photo": "ID Photo Provided",
    "credentials_created": "Credentials Created",
    "onboarding_day": "Onboarding Day",
}


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
    await notify_permission_holders(
        db,
        Permission.ONBOARDING_MANAGE,
        title="New hire added to onboarding",
        body=f"{hire.name} — {hire.role_title or 'role not set'}",
        link="/onboarding",
        exclude_account_id=account.id,
        require_preference=Account.notify_on_new_hire_added,
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

    # Validate every changed checklist field's role permission BEFORE writing
    # anything — otherwise a request touching one allowed field and one
    # blocked field could partially apply, which is worse than rejecting the
    # whole request outright. Fields absent from ROLE_FIELD_ACCESS (name,
    # start_date, etc.) aren't part of the SOP's protected ranges, so they're
    # open to any onboarding role (already enforced by WriterAccount above).
    for field in changes:
        allowed_roles = ROLE_FIELD_ACCESS.get(field)
        if allowed_roles is not None and account.role not in allowed_roles:
            label = FIELD_LABELS.get(field, field)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your role can't edit '{label}'.",
            )

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


@router.post("/notify", status_code=status.HTTP_204_NO_CONTENT)
async def notify_cliq(
    payload: CliqNotifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> None:
    """Relays the "Notify" confirmation dialog's previewed message to Zoho
    Cliq — ported from the standalone onboarding app's POST /api/notify/cliq.
    Gated the same as every other onboarding write (require_onboarding_writer)
    rather than the source app's plain require_account, since sending a
    notification is a module action like any other under the one-role-per-
    module policy."""
    try:
        await send_cliq_notification(payload.message)
    except CliqNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CliqRejectedError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    await record_activity(
        db,
        action="Sent Cliq notification",
        category=ActivityCategory.ONBOARDING,
        account=account,
        target=payload.message.splitlines()[0] if payload.message else None,
    )
