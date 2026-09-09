"""add onboarding and attendance tables

Merges in the new_hires (onboarding checklist) and violation_records /
violation_import_batches (attendance violation tracking) tables ported from
the two standalone apps, plus the new account_role/activity_category enum
values those domains need (see app/models/account.py, app/models/activity_log.py).

Revision ID: e1c5959113bd
Revises: c0ac16e500b6
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e1c5959113bd"
down_revision: Union[str, None] = "c0ac16e500b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- widen existing enums (requires Postgres 12+; adding a value is not
    # transactional pre-12, and the new value can't be used in the same
    # transaction it's added in on any version — fine here since nothing
    # below reads/writes 'recruitment'/'onboarding'/'attendance' yet) ---
    op.execute("ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'recruitment'")
    op.execute("ALTER TYPE activity_category ADD VALUE IF NOT EXISTS 'onboarding'")
    op.execute("ALTER TYPE activity_category ADD VALUE IF NOT EXISTS 'attendance'")

    # --- new_hires (onboarding checklist tracker) ---
    op.create_table(
        "new_hires",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("role_title", sa.String(length=150), nullable=False),
        sa.Column("start_date", sa.String(length=100), nullable=False),
        sa.Column("recruitment_lead", sa.String(length=150), nullable=False),
        sa.Column("onboarding_specialist", sa.String(length=150), nullable=False),
        sa.Column("jo_discussion", sa.Boolean(), nullable=False),
        sa.Column("confirmation_signed", sa.Boolean(), nullable=False),
        sa.Column("welcome_email_sent", sa.Boolean(), nullable=False),
        sa.Column("completed_by", sa.String(length=200), nullable=True),
        sa.Column("new_hire_info", sa.Boolean(), nullable=False),
        sa.Column("id_photo", sa.Boolean(), nullable=False),
        sa.Column("credentials_created", sa.Boolean(), nullable=False),
        sa.Column("onboarding_day", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- violation_records (attendance violation tracking) ---
    violation_office = postgresql.ENUM("PH", "CO", name="violation_office")
    violation_office.create(op.get_bind())
    violation_type = postgresql.ENUM(
        "Late Arrival", "Call Out", "Early Out", "NCNS", "Other", name="violation_type"
    )
    violation_type.create(op.get_bind())
    violation_email_status = postgresql.ENUM(
        "Draft",
        "Ready to Prepare",
        "Email Prepared",
        "Approved",
        "Hold",
        "Needs Correction",
        "Sent",
        "Failed",
        "Resend Approved",
        name="violation_email_status",
    )
    violation_email_status.create(op.get_bind())

    op.create_table(
        "violation_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("violation_record_id", sa.String(length=64), nullable=False),
        sa.Column("office", postgresql.ENUM(name="violation_office", create_type=False), nullable=False),
        sa.Column("employee_name", sa.String(length=255), nullable=False),
        sa.Column("employee_email", sa.String(length=255), nullable=False),
        sa.Column(
            "violation_type", postgresql.ENUM(name="violation_type", create_type=False), nullable=False
        ),
        sa.Column("violation_type_other", sa.String(length=255), nullable=True),
        sa.Column("violation_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "email_status",
            postgresql.ENUM(name="violation_email_status", create_type=False),
            nullable=False,
        ),
        sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_to", sa.String(length=255), nullable=True),
        sa.Column("zoho_message_id", sa.String(length=255), nullable=True),
        sa.Column("automation_result", sa.String(length=64), nullable=True),
        sa.Column("automation_error", sa.Text(), nullable=True),
        sa.Column("resend_of", sa.Integer(), nullable=True),
        sa.Column("resent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cc_addresses", sa.String(length=500), nullable=True),
        sa.Column("from_address", sa.String(length=255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["approved_by"], ["accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resend_of"], ["violation_records.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_violation_records_violation_record_id"),
        "violation_records",
        ["violation_record_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_violation_records_employee_email"), "violation_records", ["employee_email"], unique=False
    )
    op.create_index(
        op.f("ix_violation_records_email_status"), "violation_records", ["email_status"], unique=False
    )

    # --- violation_import_batches ---
    op.create_table(
        "violation_import_batches",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("imported_by", sa.UUID(), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("success_count", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(["imported_by"], ["accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("violation_import_batches")
    op.drop_index(op.f("ix_violation_records_email_status"), table_name="violation_records")
    op.drop_index(op.f("ix_violation_records_employee_email"), table_name="violation_records")
    op.drop_index(op.f("ix_violation_records_violation_record_id"), table_name="violation_records")
    op.drop_table("violation_records")
    postgresql.ENUM(name="violation_email_status").drop(op.get_bind())
    postgresql.ENUM(name="violation_type").drop(op.get_bind())
    postgresql.ENUM(name="violation_office").drop(op.get_bind())

    op.drop_table("new_hires")

    # Postgres can't drop a single enum value, only the whole type — reverting
    # account_role/activity_category to their pre-merge value sets would mean
    # recreating each type and every column that uses it. Not attempted here;
    # if a downgrade is ever needed, drop these three added values by hand.