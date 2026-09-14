"""add previous_violations_override to violation_records

Lets a human override the auto-detected "previous attendance violation for
this month" summary on a single record — see
app/models/violation.py's previous_violations_override docstring. NULL (the
column's default) preserves today's behavior exactly (auto-detect from the
employee's other Sent records this month); this migration only adds the
column, it never populates it, so every existing record keeps auto-detecting
until someone explicitly overrides it.

Revision ID: 8a1f4c6d2e93
Revises: 2f8c6a4e9d17
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8a1f4c6d2e93"
down_revision: Union[str, None] = "2f8c6a4e9d17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "violation_records",
        sa.Column(
            "previous_violations_override",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("violation_records", "previous_violations_override")
