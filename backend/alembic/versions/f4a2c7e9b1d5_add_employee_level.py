"""add employees.level

The org's fixed 7-rung career ladder (see app/models/employee.py's
EmployeeLevel) — a real Postgres enum, same pattern as employee_status.
Existing rows default to L1 - Associate.

Revision ID: f4a2c7e9b1d5
Revises: c8a1e6f3d2b9
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f4a2c7e9b1d5"
down_revision: Union[str, None] = "c8a1e6f3d2b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMPLOYEE_LEVEL_VALUES = [
    "L1 - Associate",
    "L2 - Senior Associate",
    "L3 - Coordinator",
    "L4 - Senior Coordinator",
    "L5 - Specialist",
    "L6 - Captain",
    "L7 - Manager",
]


def upgrade() -> None:
    employee_level = postgresql.ENUM(*EMPLOYEE_LEVEL_VALUES, name="employee_level")
    employee_level.create(op.get_bind())
    op.add_column(
        "employees",
        sa.Column(
            "level",
            postgresql.ENUM(*EMPLOYEE_LEVEL_VALUES, name="employee_level", create_type=False),
            nullable=False,
            server_default="L1 - Associate",
        ),
    )
    op.create_index(op.f("ix_employees_level"), "employees", ["level"], unique=False)
    # Match status's pattern (a Python-side default only, no lingering
    # DB-side default) — the server_default above only exists to satisfy
    # NOT NULL for rows that already existed before this migration ran.
    op.alter_column("employees", "level", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_employees_level"), table_name="employees")
    op.drop_column("employees", "level")
    postgresql.ENUM(name="employee_level").drop(op.get_bind())
