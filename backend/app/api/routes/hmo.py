"""HMO Management — replaces the earlier frontend-only prototype with a real
API, per the SOP in TGO_HMO_Management_Portal_Update_Requirements.docx (see
app/models/hmo.py's module docstring for the full lifecycle this backs).

Activity history (SOP section 8) reuses the shared ActivityLog table via
record_activity() with category=ActivityCategory.BENEFITS, rather than a
bespoke per-module audit table — same reasoning already written into
app/api/routes/new_hires.py for the Onboarding module.
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_account, require_benefits_writer, require_permission
from app.core.db import get_db
from app.models.account import Account
from app.models.activity_log import ActivityCategory
from app.models.employee import Employee
from app.models.hmo import HmoBillingPeriod, HmoMember, HmoMemberType, HmoRequest
from app.models.permission import Permission
from app.schemas.hmo import (
    HmoBillingPeriodCreate,
    HmoBillingPeriodRead,
    HmoBillingPeriodUpdate,
    HmoMemberCreate,
    HmoMemberRead,
    HmoMemberUpdate,
    HmoRequestCreate,
    HmoRequestRead,
    HmoRequestUpdate,
)
from app.services.activity_log import record_activity

router = APIRouter(
    prefix="/hmo",
    tags=["hmo"],
    dependencies=[Depends(require_permission(Permission.BENEFITS_VIEW))],
)

CurrentAccount = Annotated[Account | None, Depends(get_current_account)]
WriterAccount = Annotated[Account, Depends(require_benefits_writer)]


def _get_or_404(member: HmoMember | None) -> HmoMember:
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HMO member not found")
    return member


# --- Members --------------------------------------------------------------


@router.get("/members", response_model=list[HmoMemberRead])
async def list_hmo_members(
    db: Annotated[AsyncSession, Depends(get_db)],
    member_type: HmoMemberType | None = None,
) -> list[HmoMember]:
    stmt = select(HmoMember)
    if member_type:
        stmt = stmt.where(HmoMember.member_type == member_type)
    stmt = stmt.order_by(HmoMember.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/members/{member_id}", response_model=HmoMemberRead)
async def get_hmo_member(member_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> HmoMember:
    return _get_or_404(await db.get(HmoMember, member_id))


@router.post("/members", response_model=HmoMemberRead, status_code=status.HTTP_201_CREATED)
async def create_hmo_member(
    payload: HmoMemberCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> HmoMember:
    """Backs the Add HMO Member form. A Principal row snapshots
    employee_name/department from the linked Employee record at creation
    time (same "outlives a later directory edit" reasoning as Award); a
    Dependent row must reference an existing Principal via
    principal_member_id."""
    data = payload.model_dump()

    if payload.member_type == HmoMemberType.PRINCIPAL:
        if not payload.employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="employee_id is required for a Principal member.",
            )
        employee = await db.get(Employee, payload.employee_id)
        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        data["employee_name"] = employee.name
        data["department"] = employee.department
    else:
        if not payload.principal_member_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="principal_member_id is required for a Dependent member.",
            )
        principal = await db.get(HmoMember, payload.principal_member_id)
        if principal is None or principal.member_type != HmoMemberType.PRINCIPAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="principal_member_id must reference an existing Principal member.",
            )
        # Dependent rows carry no employee_id/employment fields of their own.
        data["employee_id"] = None

    member = HmoMember(**data, updated_by_id=account.id)
    db.add(member)
    await db.flush()

    await record_activity(
        db,
        action=f"Added {payload.member_type.value.lower()} HMO member",
        category=ActivityCategory.BENEFITS,
        account=account,
        target=str(member.id),
        details={"name": member.display_name},
        commit=False,
    )
    await db.commit()
    await db.refresh(member)
    return member


@router.patch("/members/{member_id}", response_model=HmoMemberRead)
async def update_hmo_member(
    member_id: UUID,
    payload: HmoMemberUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> HmoMember:
    member = _get_or_404(await db.get(HmoMember, member_id))

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(member, field, value)
    if changes:
        member.updated_by_id = account.id
    await db.flush()

    if changes:
        await record_activity(
            db,
            action="Updated HMO member record",
            category=ActivityCategory.BENEFITS,
            account=account,
            target=str(member.id),
            details={"changed_fields": list(changes.keys())},
            commit=False,
        )
    await db.commit()
    await db.refresh(member)
    return member


# --- Requests ---------------------------------------------------------------


@router.get("/requests", response_model=list[HmoRequestRead])
async def list_hmo_requests(db: Annotated[AsyncSession, Depends(get_db)]) -> list[HmoRequest]:
    result = await db.execute(select(HmoRequest).order_by(HmoRequest.submitted_date.desc()))
    return list(result.scalars().all())


@router.post("/requests", response_model=HmoRequestRead, status_code=status.HTTP_201_CREATED)
async def create_hmo_request(
    payload: HmoRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> HmoRequest:
    member = await db.get(HmoMember, payload.member_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HMO member not found")

    hmo_request = HmoRequest(**payload.model_dump())
    db.add(hmo_request)
    await db.flush()

    await record_activity(
        db,
        action=f"Submitted HMO request ({hmo_request.request_type})",
        category=ActivityCategory.BENEFITS,
        account=account,
        target=str(member.id),
        commit=False,
    )
    await db.commit()
    await db.refresh(hmo_request)
    return hmo_request


@router.patch("/requests/{request_id}", response_model=HmoRequestRead)
async def update_hmo_request(
    request_id: UUID,
    payload: HmoRequestUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> HmoRequest:
    hmo_request = await db.get(HmoRequest, request_id)
    if hmo_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HMO request not found")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(hmo_request, field, value)
    if "status" in changes:
        hmo_request.resolved_by_id = account.id
        hmo_request.resolved_at = datetime.now(timezone.utc)
    await db.flush()

    if changes:
        await record_activity(
            db,
            action=f"Set HMO request status to {hmo_request.status.value}",
            category=ActivityCategory.BENEFITS,
            account=account,
            target=str(hmo_request.member_id),
            commit=False,
        )
    await db.commit()
    await db.refresh(hmo_request)
    return hmo_request


# --- Billing periods ---------------------------------------------------------


@router.get("/billing-periods", response_model=list[HmoBillingPeriodRead])
async def list_hmo_billing_periods(db: Annotated[AsyncSession, Depends(get_db)]) -> list[HmoBillingPeriod]:
    result = await db.execute(select(HmoBillingPeriod).order_by(HmoBillingPeriod.month))
    return list(result.scalars().all())


@router.post(
    "/billing-periods", response_model=HmoBillingPeriodRead, status_code=status.HTTP_201_CREATED
)
async def create_hmo_billing_period(
    payload: HmoBillingPeriodCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> HmoBillingPeriod:
    period = HmoBillingPeriod(**payload.model_dump())
    db.add(period)
    await db.flush()

    await record_activity(
        db,
        action="Recorded HMO billing period",
        category=ActivityCategory.BENEFITS,
        account=account,
        target=payload.month.isoformat(),
        commit=False,
    )
    await db.commit()
    await db.refresh(period)
    return period


@router.patch("/billing-periods/{period_id}", response_model=HmoBillingPeriodRead)
async def update_hmo_billing_period(
    period_id: UUID,
    payload: HmoBillingPeriodUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    account: WriterAccount,
) -> HmoBillingPeriod:
    period = await db.get(HmoBillingPeriod, period_id)
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing period not found")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(period, field, value)
    await db.flush()

    if changes:
        await record_activity(
            db,
            action="Updated HMO billing period",
            category=ActivityCategory.BENEFITS,
            account=account,
            target=period.month.isoformat(),
            commit=False,
        )
    await db.commit()
    await db.refresh(period)
    return period
