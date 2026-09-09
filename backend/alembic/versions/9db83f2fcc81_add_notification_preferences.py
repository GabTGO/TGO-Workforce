"""add notification-inbox preference toggles to accounts

Revision ID: 9db83f2fcc81
Revises: d2bbf400d5ab
Create Date: 2026-09-09 00:00:05.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9db83f2fcc81"
down_revision: Union[str, None] = "d2bbf400d5ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("notify_on_violation_review", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "accounts",
        sa.Column("notify_on_new_hire_added", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("accounts", "notify_on_new_hire_added")
    op.drop_column("accounts", "notify_on_violation_review")
