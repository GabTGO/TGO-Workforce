"""create list_options table

The shared, editable Department/Position suggestion lists for the Edit
Employee dialog's combobox — see app/models/list_options.py's docstring.
Seeded from src/data/employees.ts's DEPARTMENTS/POSITIONS constants (the
frontend previously hardcoded these; this migration is what makes them
mutable and shared org-wide instead of a frontend constant or, briefly,
per-browser localStorage).

Revision ID: c4e8b1f2a6d7
Revises: 8a1f4c6d2e93
Create Date: 2026-09-16 00:00:00.000000

"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c4e8b1f2a6d7"
down_revision: Union[str, None] = "8a1f4c6d2e93"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEPARTMENTS_SEED = [
    "Dispatch",
    "Business Admin",
    "Recruitment",
    "Management",
    "Sales",
    "FHP",
    "Projects",
    "Payroll",
]

POSITIONS_SEED = [
    "L1 - Dispatcher",
    "L2 - Dispatcher",
    "Spanish Dispatcher",
    "Dispatch Lead",
    "Dispatch Supervisor",
    "Business Associate",
    "Recruitment Associate",
    "Talent Acquisition Lead",
    "Sales Representative",
    "US Payroll Specialists",
    "Payroll Associate",
    "FHP - VA",
    "FHP - Bid Coordinator",
    "Chief of Staff",
    "HR Transport",
    "Onboarding & Offboarding Specialist",
    "AI & Automations Lead",
    "Head of BA",
    "Head of Dispatch",
    "Head of HR",
    "Head of Projects & Payroll",
]


def upgrade() -> None:
    op.create_table(
        "list_options",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("departments", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("positions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("id = 1", name="list_options_singleton"),
    )

    # Seeded via a CAST-from-string rather than op.bulk_insert with a Python
    # list value — SQLAlchemy has no literal-value renderer for JSONB, so a
    # bulk_insert of a real list fails specifically under `alembic upgrade
    # --sql` (offline mode has to inline literal values, no parameter
    # binding available); a bound string parameter cast to jsonb in the SQL
    # text itself sidesteps that entirely and works in both offline and
    # online mode.
    op.execute(
        sa.text(
            "INSERT INTO list_options (id, departments, positions) "
            "VALUES (1, CAST(:departments AS jsonb), CAST(:positions AS jsonb))"
        ).bindparams(
            departments=json.dumps(DEPARTMENTS_SEED),
            positions=json.dumps(POSITIONS_SEED),
        )
    )


def downgrade() -> None:
    op.drop_table("list_options")
