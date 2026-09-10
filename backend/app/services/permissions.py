"""Reads and writes the permission matrix — see app/models/permission.py for
what this does and doesn't govern.
"""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountRole
from app.models.permission import Permission, RolePermission

# Bypass the matrix entirely — always every permission, matrix rows or not.
FULL_ACCESS_ROLES = {AccountRole.ADMIN, AccountRole.SUPER_ADMIN}

# The six roles a Super Admin actually configures. Admin/Super Admin are
# deliberately excluded — they're never anything but full-access, so a row
# for them in the matrix would just be confusing dead UI.
MATRIX_ROLES: list[AccountRole] = [
    AccountRole.PEOPLE_OPS,
    AccountRole.HR,
    AccountRole.PROJECTS,
    AccountRole.RECRUITMENT_LEAD,
    AccountRole.ONBOARDING_SPECIALIST,
    AccountRole.VIEWER,
]

PERMISSION_LABELS: dict[Permission, dict[str, str]] = {
    Permission.EMPLOYEES_VIEW: {
        "title": "View Employees",
        "description": "See the Employee Directory.",
    },
    Permission.EMPLOYEES_MANAGE: {
        "title": "Manage Employees",
        "description": "Create, edit, delete and import employee records.",
    },
    Permission.ONBOARDING_VIEW: {
        "title": "View Onboarding",
        "description": "See the onboarding checklist tracker.",
    },
    Permission.ONBOARDING_MANAGE: {
        "title": "Manage Onboarding",
        "description": "Add, edit and delete new-hire rows (still subject to the SOP's "
        "Recruitment Lead / Onboarding Specialist checklist-field split).",
    },
    Permission.ATTENDANCE_VIEW: {
        "title": "View Attendance Violations",
        "description": "See the attendance violation tracker.",
    },
    Permission.ATTENDANCE_MANAGE: {
        "title": "Manage Attendance Violations",
        "description": "Create, edit, prepare and import violation records.",
    },
    Permission.ATTENDANCE_APPROVE: {
        "title": "Approve Attendance Violations",
        "description": "Approve, hold, and send violation emails.",
    },
}

# Default grants — matches this app's behavior from *before* the matrix
# existed, so turning the matrix on doesn't silently change anyone's access
# until a Super Admin actually edits it. The migration that creates
# role_permissions seeds exactly this.
DEFAULT_GRANTS: dict[AccountRole, set[Permission]] = {
    AccountRole.PEOPLE_OPS: {Permission.EMPLOYEES_VIEW, Permission.EMPLOYEES_MANAGE},
    AccountRole.HR: {
        Permission.EMPLOYEES_VIEW,
        Permission.ATTENDANCE_VIEW,
        Permission.ATTENDANCE_MANAGE,
        Permission.ATTENDANCE_APPROVE,
    },
    AccountRole.PROJECTS: {Permission.EMPLOYEES_VIEW, Permission.ATTENDANCE_VIEW, Permission.ATTENDANCE_MANAGE},
    AccountRole.RECRUITMENT_LEAD: {
        Permission.EMPLOYEES_VIEW,
        Permission.ONBOARDING_VIEW,
        Permission.ONBOARDING_MANAGE,
    },
    AccountRole.ONBOARDING_SPECIALIST: {
        Permission.EMPLOYEES_VIEW,
        Permission.ONBOARDING_VIEW,
        Permission.ONBOARDING_MANAGE,
    },
    AccountRole.VIEWER: {Permission.EMPLOYEES_VIEW},
}


async def get_account_permissions(db: AsyncSession, account: Account) -> set[Permission]:
    """Every permission this specific account currently has, computed fresh
    from its role — used both by has_permission() below and to populate
    AccountRead.permissions for the frontend's own nav/page gating."""
    if account.role in FULL_ACCESS_ROLES:
        return set(Permission)
    result = await db.execute(select(RolePermission.permission).where(RolePermission.role == account.role))
    return set(result.scalars().all())


async def has_permission(db: AsyncSession, account: Account, permission: Permission) -> bool:
    if account.role in FULL_ACCESS_ROLES:
        return True
    result = await db.execute(
        select(RolePermission).where(
            RolePermission.role == account.role, RolePermission.permission == permission
        )
    )
    return result.scalar_one_or_none() is not None


async def get_full_matrix(db: AsyncSession) -> dict[AccountRole, set[Permission]]:
    result = await db.execute(select(RolePermission).where(RolePermission.role.in_(MATRIX_ROLES)))
    matrix: dict[AccountRole, set[Permission]] = {role: set() for role in MATRIX_ROLES}
    for row in result.scalars().all():
        matrix[row.role].add(row.permission)
    return matrix


async def replace_matrix(db: AsyncSession, matrix: dict[AccountRole, set[Permission]]) -> None:
    """Wholesale replace: deletes every existing grant for the roles present
    in `matrix` and re-inserts exactly what's given. The Save button sends
    the entire editable matrix at once, so this is one atomic operation
    rather than N per-cell races. Silently ignores any role outside
    MATRIX_ROLES (e.g. if a caller accidentally includes admin/super_admin)
    rather than erroring — those roles just have nothing to store."""
    roles = [role for role in matrix if role in MATRIX_ROLES]
    if not roles:
        return
    await db.execute(delete(RolePermission).where(RolePermission.role.in_(roles)))
    for role in roles:
        for permission in matrix[role]:
            db.add(RolePermission(role=role, permission=permission))
    await db.flush()
