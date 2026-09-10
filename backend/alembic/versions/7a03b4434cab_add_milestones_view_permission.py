"""add milestones.view enum value to permission

Milestones (Anniversaries + Birthdays) was previously ungated — open to
every signed-in role, same as it always had been before the permission
matrix existed. This adds it as its own row in the matrix so a Super Admin
can hide/show it per role independently of Employee Directory access — see
Permission.MILESTONES_VIEW's own comment in app/models/permission.py.

This migration ONLY adds the enum value — it must NOT also use it (e.g. in
an INSERT) in the same migration/transaction, same restriction documented in
e642378655d7 and f02ad8c1623a. The grant seed is the next migration
(68560bf36089), which runs in its own, later transaction once this value is
safely committed.

Revision ID: 7a03b4434cab
Revises: 1b1a90d68767
Create Date: 2026-09-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7a03b4434cab"
down_revision: Union[str, None] = "1b1a90d68767"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE permission ADD VALUE IF NOT EXISTS 'milestones.view'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do here (see e642378655d7 for the same limitation).
    pass
