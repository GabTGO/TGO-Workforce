"""add notify_on_hmo_member_added preference toggle to accounts

Same reasoning as 9db83f2fcc81's notify_on_new_hire_added — gates HMO
Management's own in-app notification-inbox event (see
app/services/notify.py's notify_permission_holders call in
app/api/routes/hmo.py), only relevant to Permission.BENEFITS_MANAGE holders.

Revision ID: c3d7a2f9e5b1
Revises: b8f2e6c4d1a9
Create Date: 2026-09-30 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d7a2f9e5b1"
down_revision: Union[str, None] = "b8f2e6c4d1a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("notify_on_hmo_member_added", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("accounts", "notify_on_hmo_member_added")
