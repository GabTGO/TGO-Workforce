"""make employees.level free text + admin-editable

Reverses f4a2c7e9b1d5's decision to make Level a fixed 7-value Postgres
enum: it needs to work like department/position instead — free text on the
Employee row, with an admin-manageable (add/rename/delete) preset list
shared via list_options.levels (see app/models/list_options.py and
@/components/creatable-combobox-field.tsx).

Existing rows that were auto-defaulted to "L1 - Associate" by the previous
migration are reset back to empty — nobody actually chose that value, and
the whole point of this change is that Level starts blank until someone
sets it by hand (the Directory renders that as "—").

Revision ID: a3d9f5c2e8b4
Revises: f4a2c7e9b1d5
Create Date: 2026-09-21 00:00:00.000000

"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a3d9f5c2e8b4"
down_revision: Union[str, None] = "f4a2c7e9b1d5"
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
    # Nobody actually chose "L1 - Associate" — that was the old enum's
    # NOT NULL default, written into every row that existed when
    # f4a2c7e9b1d5 ran. Blank it out so the Directory shows "—" instead of a
    # value that looks manually set but wasn't.
    op.execute("UPDATE employees SET level = '' WHERE level = 'L1 - Associate'")

    op.alter_column(
        "employees",
        "level",
        existing_type=postgresql.ENUM(*EMPLOYEE_LEVEL_VALUES, name="employee_level"),
        type_=sa.String(length=100),
        postgresql_using="level::text",
        existing_nullable=False,
    )
    op.drop_index(op.f("ix_employees_level"), table_name="employees")
    postgresql.ENUM(name="employee_level").drop(op.get_bind())

    # New admin-editable "levels" preset list — seeded with the same 7
    # values the old fixed enum had, so nothing already using them changes;
    # an admin can add/rename/delete from here going forward (see
    # backend/app/api/routes/list_options.py).
    op.add_column(
        "list_options",
        sa.Column(
            "levels",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.execute(
        sa.text("UPDATE list_options SET levels = CAST(:levels AS jsonb) WHERE id = 1").bindparams(
            levels=json.dumps(EMPLOYEE_LEVEL_VALUES)
        )
    )
    op.alter_column("list_options", "levels", server_default=None)


def downgrade() -> None:
    op.drop_column("list_options", "levels")

    # Lossy: any custom level an admin added since this migration ran
    # doesn't fit the old fixed enum, so it's reset to L1 rather than
    # failing the downgrade outright — same tradeoff as other lossy
    # downgrades in this app (see b7e2d4a9f1c6's photo_url truncation).
    quoted_values = ", ".join(f"'{v}'" for v in EMPLOYEE_LEVEL_VALUES)
    op.execute(
        f"UPDATE employees SET level = 'L1 - Associate' WHERE level NOT IN ({quoted_values})"
    )
    employee_level = postgresql.ENUM(*EMPLOYEE_LEVEL_VALUES, name="employee_level")
    employee_level.create(op.get_bind())
    op.alter_column(
        "employees",
        "level",
        existing_type=sa.String(length=100),
        type_=postgresql.ENUM(*EMPLOYEE_LEVEL_VALUES, name="employee_level", create_type=False),
        postgresql_using="level::employee_level",
        existing_nullable=False,
    )
    op.create_index(op.f("ix_employees_level"), "employees", ["level"], unique=False)
