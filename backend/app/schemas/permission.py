from pydantic import BaseModel

from app.models.account import AccountRole
from app.models.permission import Permission


class PermissionInfo(BaseModel):
    """One row of the matrix — the catalog entry, not a grant."""

    key: Permission
    title: str
    description: str


class RoleMatrixEntry(BaseModel):
    """One column of the matrix for one configurable role — its currently
    granted permissions."""

    role: AccountRole
    permissions: list[Permission]


class PermissionMatrixRead(BaseModel):
    permissions: list[PermissionInfo]
    roles: list[RoleMatrixEntry]


class PermissionMatrixUpdate(BaseModel):
    """The whole editable matrix, replaced atomically. Keyed by role so the
    Save button can send exactly what's checked in the UI — any role not
    included is left untouched (not implicitly cleared), and admin/super_admin
    keys are silently ignored since they always have everything."""

    grants: dict[AccountRole, list[Permission]]
