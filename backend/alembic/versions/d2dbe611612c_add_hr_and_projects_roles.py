"""split attendance roles: add hr and projects enum values

Corrects an earlier merge decision: attendance was modeled as one "hub_lead"
role, but the TGO Attendance Policy Violation Email Automation SOP v1.1
(section 17, "Roles and Responsibilities") — and the standalone attendance
app's own UserRole enum — requires two distinct roles: HR (reviews and holds
sole approve/hold/needs-correction/resend/send authority) and Projects (can
create/edit/prepare a record but never approve/send it).

This migration ONLY adds the two new enum values — same reason as
e642378655d7/f7a1b2c3d4e5: Postgres refuses to use a new enum value before
it's committed, and this repo's env.py now runs each migration in its own
transaction (transaction_per_migration=True) specifically so this pattern
works. The data backfill lives in the next migration (7362741cbb88).

Revision ID: d2dbe611612c
Revises: f7a1b2c3d4e5
Create Date: 2026-09-09 00:00:02.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d2dbe611612c"
down_revision: Union[str, None] = "f7a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'hr'")
    op.execute("ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'projects'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do here (see e642378655d7 for the same limitation).
    pass
