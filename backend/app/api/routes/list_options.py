"""Manages the shared Department/Position/Level suggestion lists shown in
the Edit Employee and New Hire dialogs' combobox (see
@/components/creatable-combobox-field.tsx). Employee.department/position/
level stay plain free-text on the employee record itself
(app/models/employee.py) — these are only the presets offered when picking
a value, so renaming or removing one here never touches any employee
already using that value; it only changes what's suggested going forward.

Read is gated on Permission.EMPLOYEES_VIEW (same as the Employee Directory
itself); every mutation requires Permission.EMPLOYEES_MANAGE, same as
editing an employee record. The frontend additionally re-prompts for the
shared "manage" password before a rename or delete specifically (not add) —
a UI-level accident guard layered on top of this real permission check,
matching how the rest of the Manage Employees screen already works (see
manage-employees-dialog.tsx's own password re-prompt before deleting an
employee).
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_employee_writer, require_permission
from app.core.db import get_db
from app.models.account import Account
from app.models.permission import Permission
from app.schemas.list_options import (
    AddOptionRequest,
    ListOptionsRead,
    RemoveOptionRequest,
    RenameOptionRequest,
)
from app.services.list_options import get_list_options

router = APIRouter(
    prefix="/list-options",
    tags=["list-options"],
    dependencies=[Depends(require_permission(Permission.EMPLOYEES_VIEW))],
)

WriterAccount = Annotated[Account, Depends(require_employee_writer)]
DbSession = Annotated[AsyncSession, Depends(get_db)]

ListKey = Literal["departments", "positions", "levels"]


@router.get("", response_model=ListOptionsRead)
async def get_options(db: DbSession) -> ListOptionsRead:
    options = await get_list_options(db)
    return ListOptionsRead.model_validate(options)


@router.post("/{list_key}/add", response_model=ListOptionsRead)
async def add_option(
    list_key: ListKey, payload: AddOptionRequest, db: DbSession, account: WriterAccount
) -> ListOptionsRead:
    value = payload.value.strip()
    if not value:
        raise HTTPException(400, "Value can't be empty")

    options = await get_list_options(db)
    current = getattr(options, list_key)
    if value not in current:
        setattr(options, list_key, [*current, value])
        await db.commit()
        await db.refresh(options)
    return ListOptionsRead.model_validate(options)


@router.post("/{list_key}/rename", response_model=ListOptionsRead)
async def rename_option(
    list_key: ListKey, payload: RenameOptionRequest, db: DbSession, account: WriterAccount
) -> ListOptionsRead:
    new_value = payload.new_value.strip()
    if not new_value:
        raise HTTPException(400, "Value can't be empty")

    options = await get_list_options(db)
    current = getattr(options, list_key)
    setattr(options, list_key, [new_value if v == payload.old_value else v for v in current])
    await db.commit()
    await db.refresh(options)
    return ListOptionsRead.model_validate(options)


@router.post("/{list_key}/remove", response_model=ListOptionsRead)
async def remove_option(
    list_key: ListKey, payload: RemoveOptionRequest, db: DbSession, account: WriterAccount
) -> ListOptionsRead:
    options = await get_list_options(db)
    current = getattr(options, list_key)
    setattr(options, list_key, [v for v in current if v != payload.value])
    await db.commit()
    await db.refresh(options)
    return ListOptionsRead.model_validate(options)
