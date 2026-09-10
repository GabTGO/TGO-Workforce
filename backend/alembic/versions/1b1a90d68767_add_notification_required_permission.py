"""add notifications.required_permission

Lets GET /notifications re-check a notification against the recipient's
*current* permissions instead of only what qualified them when it was
created — see app/models/notification.py and the _visible_notifications_filter
helper in app/api/routes/notifications.py. Reuses the existing `permission`
enum type (created in 157a2807ba5c) — create_type=False, same pattern as
role_permissions.permission.

Revision ID: 1b1a90d68767
Revises: e702614df5c3
Create Date: 2026-09-10 12:30:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "1b1a90d68767"
down_revision: Union[str, None] = "e702614df5c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSION_ENUM = postgresql.ENUM(
    "employees.view", "employees.manage", "onboarding.view", "onboarding.manage",
    "attendance.view", "attendance.manage", "attendance.approve",
    name="permission", create_type=False,
)


def upgrade() -> None:
    op.add_column("notifications", sa.Column("required_permission", PERMISSION_ENUM, nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "required_permission")
