"""add accounts.is_restricted, app_settings table

is_restricted (Account): a Super Admin can force any account to view-only
everywhere without touching its role — see Account.is_restricted's own
comment and app/services/permissions.py's get_account_permissions.

app_settings: a single-row (id=1) table of runtime settings a Super Admin
controls without a redeploy — currently just invite_only_signup, which locks
/auth/zoho/callback to rejecting a brand-new account with no matching
PendingInvite. See app/services/app_settings.py for the get-or-create
accessor; this migration also seeds the one row so it always exists.

Revision ID: e702614df5c3
Revises: 157a2807ba5c
Create Date: 2026-09-10 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e702614df5c3"
down_revision: Union[str, None] = "157a2807ba5c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("is_restricted", sa.Boolean(), server_default="false", nullable=False),
    )

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("invite_only_signup", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("id = 1", name="app_settings_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("INSERT INTO app_settings (id, invite_only_signup) VALUES (1, false)")


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_column("accounts", "is_restricted")
