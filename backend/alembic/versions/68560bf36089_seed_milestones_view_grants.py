"""seed milestones.view grants for every matrix role

Separate migration from 7a03b4434cab on purpose: that migration only added
the 'milestones.view' enum value, and Postgres refuses to use a brand-new
enum value inside the same transaction that added it. By the time this one
runs, the value is safely usable.

Grants milestones.view to every one of the six matrix roles — mirrors
DEFAULT_GRANTS in app/services/permissions.py, matching Milestones'
previously-ungated ("every signed-in role can see it") behavior so this
migration doesn't silently change anyone's access.

Revision ID: 68560bf36089
Revises: 7a03b4434cab
Create Date: 2026-09-11 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "68560bf36089"
down_revision: Union[str, None] = "7a03b4434cab"
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
    # each value with the correct cast — a bare VARCHAR bind against these
    # enum columns raises "column is of type ... but expression is of type
    # character varying" (see 157a2807ba5c's fix for the same mistake).
    account_role_enum = postgresql.ENUM(
        "super_admin", "admin", "people_ops", "hr", "projects",
        "recruitment_lead", "onboarding_specialist", "viewer",
        name="account_role", create_type=False,
    )
    permission_enum = postgresql.ENUM(
        "employees.view", "employees.manage", "milestones.view",
        "onboarding.view", "onboarding.manage",
        "attendance.view", "attendance.manage", "attendance.approve",
        name="permission", create_type=False,
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role", account_role_enum),
        sa.column("permission", permission_enum),
    )
    op.bulk_insert(
        role_permissions,
        [{"role": role, "permission": "milestones.view"} for role in MATRIX_ROLES],
    )


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE permission = 'milestones.view'")
