"""add feedback.screenshot_urls

Lets the "Report Feedback" dialog attach one or more screenshots at report
time (see app/models/feedback.py's Feedback.screenshot_urls) — a JSONB list
of data: URLs, same inline-storage pattern FeedbackComment.image_data
already uses for reply-thread attachments.

Revision ID: c8a1e6f3d2b9
Revises: b7e2d4a9f1c6
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c8a1e6f3d2b9"
down_revision: Union[str, None] = "b7e2d4a9f1c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "feedback",
        sa.Column(
            "screenshot_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("feedback", "screenshot_urls")
