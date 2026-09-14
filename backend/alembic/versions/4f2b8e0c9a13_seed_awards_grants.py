"""seed awards.view / awards.manage default grants

Separate migration from 4d7c1f9a6b2e on purpose: that migration only added
the two enum values, and Postgres refuses to use a brand-new enum value
inside the same transaction that added it. By the time this one runs, both
values are safely usable.

Unlike milestones.view (which was previously ungated — every signed-in role
already saw Anniversaries/Birthdays before the matrix existed, so its seed
had to preserve that "everyone" baseline), Recognition & Awards is a brand
new module with no prior "open to everyone" behavior to preserve. Its
default is deliberately narrow: only People Ops starts with awards.view
*and* awards.manage. Every other matrix role starts with neither — a Super
Admin grants awards.view to whichever other roles should see the board from
the permission matrix, same as onboarding.view/attendance.view already
aren't blanket-granted to every role.

Mirrors DEFAULT_GRANTS in app/services/permissions.py.

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
    op.bulk_insert(
        role_permissions,
        [
            {"role": "people_ops", "permission": "awards.view"},
            {"role": "people_ops", "permission": "awards.manage"},
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE permission IN ('awards.view', 'awards.manage')")
