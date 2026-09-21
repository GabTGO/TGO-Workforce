"""add database_backups and backup_schedule tables

The Super Admin-only Database Backups module: on-demand or scheduled Postgres
dumps (via pg_dump, run by app/services/backup.py), stored gzip-compressed
directly in database_backups (see that model's docstring for why — no
Railway Volume or external object store wired up in this app, so this is the
zero-new-infra option) and downloadable from the UI.

backup_schedule is a singleton (id=1) row, same pattern as app_settings/
list_options — seeded here so it always exists, same reasoning as
e702614df5c3's app_settings seed.

Revision ID: c2a7f4e91b3d
Revises: a3d9f5c2e8b4
Create Date: 2026-09-21 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c2a7f4e91b3d"
down_revision: Union[str, None] = "a3d9f5c2e8b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    backup_trigger = postgresql.ENUM("manual", "scheduled", name="backup_trigger")
    backup_trigger.create(op.get_bind())
    backup_status = postgresql.ENUM("running", "completed", "failed", name="backup_status")
    backup_status.create(op.get_bind())
    backup_frequency = postgresql.ENUM("daily", "weekly", name="backup_frequency")
    backup_frequency.create(op.get_bind())

    op.create_table(
        "database_backups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "trigger", postgresql.ENUM(name="backup_trigger", create_type=False), nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="backup_status", create_type=False),
            nullable=False,
            server_default="running",
        ),
        sa.Column("tables", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("file_gzip", sa.LargeBinary(), nullable=True),
        sa.Column("error_message", sa.String(length=2000), nullable=True),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("requested_by_label", sa.String(length=200), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["requested_by_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_database_backups_status"), "database_backups", ["status"], unique=False)
    op.create_index(op.f("ix_database_backups_created_at"), "database_backups", ["created_at"], unique=False)

    op.create_table(
        "backup_schedule",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "frequency",
            postgresql.ENUM(name="backup_frequency", create_type=False),
            nullable=False,
            server_default="daily",
        ),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=True),
        sa.Column("time_of_day", sa.Time(), nullable=False, server_default="02:00:00"),
        sa.Column("tables", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("id = 1", name="backup_schedule_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("INSERT INTO backup_schedule (id, enabled) VALUES (1, false)")


def downgrade() -> None:
    op.drop_table("backup_schedule")
    op.drop_index(op.f("ix_database_backups_created_at"), table_name="database_backups")
    op.drop_index(op.f("ix_database_backups_status"), table_name="database_backups")
    op.drop_table("database_backups")
    postgresql.ENUM(name="backup_frequency").drop(op.get_bind())
    postgresql.ENUM(name="backup_status").drop(op.get_bind())
    postgresql.ENUM(name="backup_trigger").drop(op.get_bind())
