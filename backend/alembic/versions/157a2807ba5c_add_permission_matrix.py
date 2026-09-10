"""add permission enum, role_permissions table, seed default grants

The configurable permission matrix — see app/models/permission.py and
app/services/permissions.py. `permission` is a brand-new enum type (not an
existing one being altered), so — unlike account_role — it's safe to create
and use it within this same migration/transaction.

role_permissions has no boolean "granted" column: a row's existence IS the
grant. Only the six roles in MATRIX_ROLES ever get rows here (admin/
super_admin bypass the matrix entirely in code, via FULL_ACCESS_ROLES).

Seeds exactly DEFAULT_GRANTS from app/services/permissions.py so turning the
matrix on doesn't silently change anyone's access until a Super Admin edits
it — the seed values are inlined here (not imported from the app) so this
migration keeps working unchanged even if that dict's defaults are edited
later.

Revision ID: 157a2807ba5c
Revises: f02ad8c1623a
Create Date: 2026-09-10 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "157a2807ba5c"
down_revision: Union[str, None] = "f02ad8c1623a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSION_VALUES = (
    "employees.view",
    "employees.manage",
    "onboarding.view",
    "onboarding.manage",
    "attendance.view",
    "attendance.manage",
    "attendance.approve",
)

# Mirrors DEFAULT_GRANTS in app/services/permissions.py exactly.
DEFAULT_GRANTS = {
    "people_ops": ["employees.view", "employees.manage"],
    "hr": ["employees.view", "attendance.view", "attendance.manage", "attendance.approve"],
    "projects": ["employees.view", "attendance.view", "attendance.manage"],
    "recruitment_lead": ["employees.view", "onboarding.view", "onboarding.manage"],
    "onboarding_specialist": ["employees.view", "onboarding.view", "onboarding.manage"],
    "viewer": ["employees.view"],
}


def upgrade() -> None:
    permission_enum = postgresql.ENUM(*PERMISSION_VALUES, name="permission")
    permission_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "role_permissions",
        sa.Column(
            "role",
            postgresql.ENUM(
                "super_admin", "admin", "people_ops", "hr", "projects",
                "recruitment_lead", "onboarding_specialist", "viewer",
                name="account_role", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("permission", permission_enum, nullable=False),
        sa.PrimaryKeyConstraint("role", "permission"),
    )

    role_permissions = sa.table(
        "role_permissions",
        sa.column("role", sa.String),
        sa.column("permission", sa.String),
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role": role, "permission": permission}
            for role, permissions in DEFAULT_GRANTS.items()
            for permission in permissions
        ],
    )


def downgrade() -> None:
    op.drop_table("role_permissions")
    op.execute("DROP TYPE permission")
