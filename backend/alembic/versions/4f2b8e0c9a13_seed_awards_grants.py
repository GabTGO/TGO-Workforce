"""seed awards.view / awards.manage default grants

Separate migration from 4d7c1f9a6b2e on purpose: that migration only added
the two enum values, and Postgres refuses to use a brand-new enum value
inside the same transaction that added it. By the time this one runs, both
values are safely usable.

Mirrors DEFAULT_GRANTS in app/services/permissions.py: every matrix role
gets awards.view (same "everyone can see it" treatment as milestones.view),
but only People Ops gets awards.manage by default — the role that already
holds employees.manage. A Super Admin can widen this from the permission
matrix afterward.

Revision ID: 4f2b8e0c9a13
Revises: 4d7c1f9a6b2e
Create Date: 2026-09-11 00:00:01.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4f2b8e0c9a13"
down_revision: Union[str, None] = "4d7c1f9a6b2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MATRIX_ROLES = (
    "people_ops",
    "hr",
    "projects",
    "recruitment_lead",
    "onboarding_specialist",
    "viewer",
)


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
        name="permission", create_type=False,
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role", account_role_enum),
        sa.column("permission", permission_enum),
    )
    rows = [{"role": role, "permission": "awards.view"} for role in MATRIX_ROLES]
    rows.append({"role": "people_ops", "permission": "awards.manage"})
    op.bulk_insert(role_permissions, rows)


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE permission IN ('awards.view', 'awards.manage')")
