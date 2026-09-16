"""widen accounts.photo_url to text

Lets the Profile page's "Upload a file" option store a data: URI directly in
photo_url instead of only a pasted image URL — see the comment on
app/models/account.py's Account.photo_url. VARCHAR(500) was plenty for a URL
but not for an embedded (client-downsized) image.

Revision ID: b7e2d4a9f1c6
Revises: d5f9a3c1b8e4
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e2d4a9f1c6"
down_revision: Union[str, None] = "d5f9a3c1b8e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "accounts",
        "photo_url",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    # Truncate rather than fail outright if a data: URI longer than 500
    # chars is already stored — a lossy downgrade is still better than one
    # that can't run at all.
    op.execute("UPDATE accounts SET photo_url = left(photo_url, 500) WHERE photo_url IS NOT NULL")
    op.alter_column(
        "accounts",
        "photo_url",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
