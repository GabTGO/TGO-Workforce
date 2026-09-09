"""split onboarding roles: add recruitment_lead and onboarding_specialist enum values

Corrects an earlier merge decision: onboarding was modeled as one "recruitment"
role, but the New Hire Onboarding Tracker SOP requires two distinct roles with
different checklist-field write access (Recruitment Lead: items 1-2,
Onboarding Specialist: items 4-7, item 3 shared).

This migration ONLY adds the two new enum values — it must NOT also use them
(e.g. in an UPDATE) in the same migration/transaction: Postgres refuses to use
a new enum value before it's committed ("unsafe use of new value ... enum
values must be committed before they can be used"), and Alembic runs each
migration in one transaction. The data backfill that actually assigns these
roles to accounts is the next migration (f7a1b2c3d4e5), which runs in its own,
later transaction once these values are safely committed.

Revision ID: e642378655d7
Revises: e1c5959113bd
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e642378655d7"
down_revision: Union[str, None] = "e1c5959113bd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'recruitment_lead'")
    op.execute("ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'onboarding_specialist'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do here (see the module docstring in the previous
    # migration for the same limitation on 'recruitment').
    pass
