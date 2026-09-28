"""seed benefits.view / benefits.manage default grants

The HMO Management SOP (TGO_HMO_Management_Portal_Update_Requirements.docx)
states its primary users as "HR / Admin and authorized project stakeholders".
Admin/Super Admin always bypass the matrix entirely (see
app/services/permissions.py's FULL_ACCESS_ROLES); this migration seeds the
matrix-configurable side of that: HR gets both benefits.view and
benefits.manage (they run the module day to day), Projects gets
benefits.view only (the SOP's "authorized stakeholders" monitoring the
rollout, not doing day-to-day HMO data entry). Every other matrix role
starts with neither, same as every other module's own default.

Mirrors DEFAULT_GRANTS in app/services/permissions.py.

Revision ID: b8f2e6c4d1a9
Revises: a7e5d9c1f04b
Create Date: 2026-09-30 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b8f2e6c4d1a9"
down_revision: Union[str, None] = "a7e5d9c1f04b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reuse the real column types (not sa.String) so asyncpg/psycopg bind
    # each value with the correct cast — see 157a2807ba5c's fix for the
    # "column is of type ... but expression is of type character varying"
    # mistake this avoids.
    account_role_enum = postgresql.ENUM(
        "super_admin", "admin", "people_ops", "hr", "projects",
        "recruitment_lead", "onboarding_specialist", "viewer",
        name="account_role", create_type=False,
    )
    permission_enum = postgresql.ENUM(
        "employees.view", "employees.manage", "milestones.view",
        "onboarding.view", "onboarding.manage",
        "attendance.view", "attendance.manage", "attendance.approve",
        "awards.view", "awards.manage",
        "benefits.view", "benefits.manage",
        name="permission", create_type=False,
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role", account_role_enum),
        sa.column("permission", permission_enum),
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role": "hr", "permission": "benefits.view"},
            {"role": "hr", "permission": "benefits.manage"},
            {"role": "projects", "permission": "benefits.view"},
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM role_permissions WHERE permission IN ('benefits.view', 'benefits.manage') "
        "AND role IN ('hr', 'projects')"
    )
