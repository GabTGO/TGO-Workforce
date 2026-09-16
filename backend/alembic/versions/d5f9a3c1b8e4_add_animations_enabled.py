"""add animations_enabled to accounts

Self-service preference (see app/models/account.py's Personalization block)
gating client-side page-enter transitions and dashboard count-up effects —
same on/off pattern as the existing notify_* toggles.

Revision ID: d5f9a3c1b8e4
Revises: c4e8b1f2a6d7
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5f9a3c1b8e4"
down_revision: Union[str, None] = "c4e8b1f2a6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column(
            "animations_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )


def downgrade() -> None:
    op.drop_column("accounts", "animations_enabled")
