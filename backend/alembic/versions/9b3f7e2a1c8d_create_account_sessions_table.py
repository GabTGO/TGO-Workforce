"""create account_sessions table

Server-side session tracking, added specifically so a Super Admin can see
who's currently signed in ("active sessions" on the Dashboard and User
Management) and forcibly end a specific browser's session — see
app/models/session.py's module docstring for the full design (why this is
CASCADE rather than SET NULL, why a missing session_id in an old cookie is
treated as "not tracked" rather than "revoked", etc.).

Revision ID: 9b3f7e2a1c8d
Revises: 7c1e9a4d6f2b
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "9b3f7e2a1c8d"
down_revision: Union[str, None] = "7c1e9a4d6f2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "account_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("device_label", sa.String(length=150), nullable=True),
        sa.Column("location_label", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_account_sessions_account_id", "account_sessions", ["account_id"])


def downgrade() -> None:
    op.drop_table("account_sessions")
