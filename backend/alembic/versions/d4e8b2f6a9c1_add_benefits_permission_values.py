"""add benefits.view / benefits.manage enum values to permission

Employee Benefits is a placeholder module for now (HMO Management is its
first, still-blank page) — this migration only adds the two enum values so
they exist as togglable rows in the permission matrix. Nothing is granted to
any role by default; a Super Admin turns them on from User Management once
there's real functionality behind them.

This migration ONLY adds the enum values — it must NOT also use them (e.g.
in an INSERT) in the same migration/transaction, same restriction documented
in 7a03b4434cab and f02ad8c1623a.

Revision ID: d4e8b2f6a9c1
Revises: c2a7f4e91b3d
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e8b2f6a9c1"
down_revision: Union[str, None] = "c2a7f4e91b3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE permission ADD VALUE IF NOT EXISTS 'benefits.view'")
    op.execute("ALTER TYPE permission ADD VALUE IF NOT EXISTS 'benefits.manage'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do here (see 7a03b4434cab for the same limitation).
    pass
