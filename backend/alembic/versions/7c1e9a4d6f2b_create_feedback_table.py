"""create feedback table

A Kanban-style bug/improvement board open to every signed-in account — see
app/models/feedback.py's module docstring. Three brand-new enum types
(feedback_type, feedback_status, feedback_priority), declared inline on
their columns the same way every other enum-typed table in this history was
created (see 736a9e1f335b) — op.create_table auto-creates each named enum
type as part of the table DDL, no separate CREATE TYPE step needed. That's
different from the two-phase ALTER TYPE ADD VALUE dance elsewhere in this
history (e.g. 7a03b4434cab): that restriction only applies to adding a value
to an *already-existing* enum type: a brand-new type can be created and used
in the very same migration.

Revision ID: 7c1e9a4d6f2b
Revises: 4f2b8e0c9a13
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "7c1e9a4d6f2b"
down_revision: Union[str, None] = "4f2b8e0c9a13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", sa.Enum("bug", "improvement", name="feedback_type"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "working_on_it", "resolved", "implemented", name="feedback_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum("low", "medium", "high", "urgent", name="feedback_priority"),
            server_default="medium",
            nullable=False,
        ),
        sa.Column(
            "reported_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reported_by_label", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_feedback_reported_by_id", "feedback", ["reported_by_id"])


def downgrade() -> None:
    op.drop_table("feedback")
    postgresql.ENUM(name="feedback_priority").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="feedback_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="feedback_type").drop(op.get_bind(), checkfirst=True)
