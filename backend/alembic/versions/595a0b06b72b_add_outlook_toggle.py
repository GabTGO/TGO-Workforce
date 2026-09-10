"""add app_settings.use_outlook_for_violations

An alternative to Zoho Mail for Attendance Violations while the attendance
team's Zoho Mail API credentials aren't set up — see the column's own
comment in app/models/app_settings.py and the new
/violations/{id}/send-via-outlook, /violations/bulk-send-via-outlook routes.

Revision ID: 595a0b06b72b
Revises: 68560bf36089
Create Date: 2026-09-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "595a0b06b72b"
down_revision: Union[str, None] = "68560bf36089"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column("use_outlook_for_violations", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "use_outlook_for_violations")
