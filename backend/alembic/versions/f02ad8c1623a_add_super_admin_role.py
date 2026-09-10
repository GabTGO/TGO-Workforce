"""add super_admin enum value to account_role

Super Admin sits above Admin — see the comment on AccountRole.SUPER_ADMIN in
app/models/account.py. It's the only role that can edit the permission
matrix (added in the next migration, 157a2807ba5c); Admin keeps every
capability it already had and bypasses the matrix the same way, it just can't
reconfigure it.

This migration ONLY adds the enum value — it must NOT also use it (e.g. in an
UPDATE) in the same migration/transaction, same restriction documented in
e642378655d7. Nothing backfills accounts to this role automatically; a
Super Admin is created by an existing Admin manually assigning it via User
Management (or a direct DB edit for the very first one).

Revision ID: f02ad8c1623a
Revises: 9db83f2fcc81
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f02ad8c1623a"
down_revision: Union[str, None] = "9db83f2fcc81"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'super_admin'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do here (see e642378655d7 for the same limitation).
    pass
