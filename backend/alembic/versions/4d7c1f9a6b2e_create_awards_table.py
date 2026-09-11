"""create awards table and add awards permissions

Recognition & Awards — under the Milestones nav group alongside Anniversaries
and Birthdays, but unlike those two this is its own writable module: give an
Active employee a named award, then edit/delete it. Creates the awards table
and adds the two new permission enum values (awards.view, awards.manage) in
the same migration — safe together since neither enum value is *used* (e.g.
in an INSERT) here, only added; that restriction is what forces the grant
seed into its own later migration (4f2b8e0c9a13), same pattern as
7a03b4434cab / 68560bf36089 for milestones.view.

Revision ID: 4d7c1f9a6b2e
Revises: 595a0b06b72b
Create Date: 2026-09-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4d7c1f9a6b2e"
down_revision: Union[str, None] = "595a0b06b72b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "awards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "employee_id",
            sa.String(length=20),
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("employee_name", sa.String(length=200), nullable=False),
        sa.Column("employee_office", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("awarded_date", sa.Date(), nullable=False),
        sa.Column(
            "awarded_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("awarded_by_label", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_awards_employee_id", "awards", ["employee_id"])
    op.create_index("ix_awards_awarded_by_id", "awards", ["awarded_by_id"])

    op.execute("ALTER TYPE permission ADD VALUE IF NOT EXISTS 'awards.view'")
    op.execute("ALTER TYPE permission ADD VALUE IF NOT EXISTS 'awards.manage'")


def downgrade() -> None:
    op.drop_table("awards")
    # Postgres can't drop a single enum value without recreating the whole
    # type — nothing to do for the permission values (see e642378655d7 for
    # the same limitation).
