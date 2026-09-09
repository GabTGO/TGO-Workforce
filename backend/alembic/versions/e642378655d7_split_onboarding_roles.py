"""split onboarding roles into recruitment_lead and onboarding_specialist

Corrects an earlier merge decision: onboarding was modeled as one "recruitment"
role, but the New Hire Onboarding Tracker SOP requires two distinct roles with
different checklist-field write access (Recruitment Lead: items 1-2,
Onboarding Specialist: items 4-7, item 3 shared). Adds the two correct enum
values; the old "recruitment" value is left in place (Postgres can't drop a
single enum value without recreating the whole type) but nothing in the app
reads or writes it anymore.

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

    # No account should have role='recruitment' yet (this value only existed
    # since e1c5959113bd, and nothing in the UI has offered it as a choice
    # since roles.ts was corrected in the same change as this migration) —
    # but reassign defensively in case anyone was seeded with it directly.
    op.execute("UPDATE accounts SET role = 'recruitment_lead' WHERE role = 'recruitment'")


def downgrade() -> None:
    # Reverse the reassignment; the added enum values themselves are left in
    # place — see the module docstring for why they can't be cleanly dropped.
    op.execute("UPDATE accounts SET role = 'recruitment' WHERE role IN ('recruitment_lead', 'onboarding_specialist')")
