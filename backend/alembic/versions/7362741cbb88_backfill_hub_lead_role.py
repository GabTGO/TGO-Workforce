"""backfill any 'hub_lead' accounts to 'hr'

Separate migration from d2dbe611612c on purpose — same reason as
f7a1b2c3d4e5: Postgres refuses to use a brand-new enum value in the same
transaction that added it, and this repo's migrations now each commit in
their own transaction (transaction_per_migration=True in env.py), so by the
time this one runs, 'hr'/'projects' are safely usable.

'hub_lead' was Attendance's sole non-admin role before this correction, with
full write+approve access — the closest equivalent in the new split is 'hr'
(which also gets both), not 'projects' (write-only), so that's what any
existing hub_lead account is reassigned to.

Revision ID: 7362741cbb88
Revises: d2dbe611612c
Create Date: 2026-09-09 00:00:03.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7362741cbb88"
down_revision: Union[str, None] = "d2dbe611612c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE accounts SET role = 'hr' WHERE role = 'hub_lead'")


def downgrade() -> None:
    op.execute("UPDATE accounts SET role = 'hub_lead' WHERE role IN ('hr', 'projects')")
