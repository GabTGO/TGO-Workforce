"""backfill any 'recruitment' accounts to 'recruitment_lead'

Separate migration from e642378655d7 on purpose: that migration only added
the 'recruitment_lead'/'onboarding_specialist' enum values, and Postgres
refuses to use a brand-new enum value inside the same transaction that added
it. Alembic commits each migration's transaction before starting the next, so
by the time this one runs, those two values are safely usable.

No account should actually have role='recruitment' at this point — that
value only ever existed since e1c5959113bd, and nothing in the UI has offered
it as a choice since roles.ts was corrected in the same change as this
migration — but reassign defensively in case anyone was seeded with it
directly (e.g. via a script or a manual DB edit).

Revision ID: f7a1b2c3d4e5
Revises: e642378655d7
Create Date: 2026-09-09 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f7a1b2c3d4e5"
down_revision: Union[str, None] = "e642378655d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE accounts SET role = 'recruitment_lead' WHERE role = 'recruitment'")


def downgrade() -> None:
    op.execute(
        "UPDATE accounts SET role = 'recruitment' WHERE role IN ('recruitment_lead', 'onboarding_specialist')"
    )
