"""create feedback_comments table

The reply thread on a feedback card — see app/models/feedback.py's
FeedbackComment docstring. Reuses the existing account_role enum type
(create_type=False, same pattern as author_role/comment tables elsewhere)
rather than declaring a new one, since a comment's author role is drawn from
the same AccountRole values as everywhere else in the app. reactions is a
plain JSONB blob defaulting to {} (emoji -> list of account id strings).

Revision ID: 2f8c6a4e9d17
Revises: 9b3f7e2a1c8d
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2f8c6a4e9d17"
down_revision: Union[str, None] = "9b3f7e2a1c8d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "feedback_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("author_label", sa.String(length=200), nullable=False),
        sa.Column(
            "author_role",
            postgresql.ENUM(name="account_role", create_type=False),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("image_data", sa.Text(), nullable=True),
        sa.Column(
            "reactions",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_feedback_comments_feedback_id", "feedback_comments", ["feedback_id"])
    op.create_index("ix_feedback_comments_author_id", "feedback_comments", ["author_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_comments_author_id", table_name="feedback_comments")
    op.drop_index("ix_feedback_comments_feedback_id", table_name="feedback_comments")
    op.drop_table("feedback_comments")
