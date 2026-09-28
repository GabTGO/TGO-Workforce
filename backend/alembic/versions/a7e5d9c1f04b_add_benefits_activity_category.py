"""add benefits enum value to activity_category

HMO Management's activity history (SOP section 8) reuses the shared
ActivityLog table instead of a bespoke per-module audit table — this adds
the one new category value it needs. Isolated in its own migration since a
freshly added enum value can't be used (e.g. in an INSERT) in the same
transaction it was added in — same restriction as d4e8b2f6a9c1 and the
ONBOARDING/ATTENDANCE additions before it.

Revision ID: a7e5d9c1f04b
Revises: f3a1c8d2b7e4
Create Date: 2026-09-28 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7e5d9c1f04b"
down_revision: Union[str, None] = "f3a1c8d2b7e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE activity_category ADD VALUE IF NOT EXISTS 'benefits'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do here (see d4e8b2f6a9c1 for the same limitation).
    pass
