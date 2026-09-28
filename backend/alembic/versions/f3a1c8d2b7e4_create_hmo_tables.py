"""create hmo_members, hmo_requests, hmo_billing_periods tables

Replaces the earlier frontend-only HMO Management prototype with a real
backend module, per the SOP in TGO_HMO_Management_Portal_Update_
Requirements.docx (prepared 2026-09-28) — see app/models/hmo.py's module
docstring for the full lifecycle this backs (eligibility -> manager
evaluation -> enrollment -> ETIQA activation -> card release -> billing ->
offboarding/removal, for both employees and their dependents).

Every enum type here is brand new, so — unlike a value ADDED to an existing
enum (e.g. d4e8b2f6a9c1) — there's no "don't use it in the same transaction"
restriction: a freshly created type can be used by a CREATE TABLE in the same
migration.

Revision ID: f3a1c8d2b7e4
Revises: d4e8b2f6a9c1
Create Date: 2026-09-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f3a1c8d2b7e4"
down_revision: Union[str, None] = "d4e8b2f6a9c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hmo_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "member_type",
            sa.Enum("Principal", "Dependent", name="hmo_member_type"),
            nullable=False,
        ),
        # Principal-only
        sa.Column(
            "employee_id",
            sa.String(length=20),
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("employee_name", sa.String(length=200), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column(
            "employment_status",
            sa.Enum("Active", "Resigned", "Terminated", "Withdrawn", name="hmo_employment_status"),
            nullable=True,
        ),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("eligibility_date", sa.Date(), nullable=True),
        sa.Column(
            "manager_evaluation",
            sa.Enum(
                "Not Yet Required",
                "Pending",
                "Approved",
                "Extended",
                "On Hold",
                "Not Approved",
                name="hmo_manager_evaluation",
            ),
            nullable=True,
        ),
        # Dependent-only
        sa.Column(
            "principal_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hmo_members.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "relationship_to_principal",
            sa.Enum("Spouse", "Child", "Parent", "Other", name="hmo_relationship"),
            nullable=True,
        ),
        sa.Column("dependent_name", sa.String(length=200), nullable=True),
        sa.Column("birthday", sa.Date(), nullable=True),
        # Membership & coverage
        sa.Column("hmo_card_number", sa.String(length=100), nullable=True),
        sa.Column(
            "member_status",
            sa.Enum(
                "Not Yet Active", "Active", "Inactive", "Suspended", "Terminated",
                name="hmo_member_status",
            ),
            nullable=False,
            server_default="Not Yet Active",
        ),
        sa.Column("rank", sa.String(length=50), nullable=True),
        sa.Column("room_and_board", sa.String(length=50), nullable=True),
        sa.Column("mbl", sa.String(length=50), nullable=True),
        sa.Column("dental", sa.String(length=50), nullable=True),
        sa.Column("ape", sa.String(length=50), nullable=True),
        # Payment
        sa.Column("monthly_premium", sa.Numeric(10, 2), nullable=True),
        sa.Column("biweekly_deduction", sa.Numeric(10, 2), nullable=True),
        sa.Column(
            "billing_status",
            sa.Enum(
                "Not Yet Billed",
                "Included in Billing",
                "Adjustment Required",
                "For Removal",
                "Removed from Billing",
                name="hmo_billing_status",
            ),
            nullable=False,
            server_default="Not Yet Billed",
        ),
        sa.Column("last_billing_month", sa.Date(), nullable=True),
        sa.Column("billing_remarks", sa.Text(), nullable=True),
        # Enrollment tracking
        sa.Column(
            "enrollment_status",
            sa.Enum(
                "Not Eligible",
                "For Manager Evaluation",
                "Waiting for Requirements",
                "Ready for Endorsement",
                "Endorsed to ETIQA",
                "For Processing",
                "Activated",
                "On Hold",
                "Rejected",
                "Cancelled",
                name="hmo_enrollment_status",
            ),
            nullable=False,
            server_default="Not Eligible",
        ),
        sa.Column("date_endorsed_to_etiqa", sa.Date(), nullable=True),
        sa.Column("hmo_effectivity_date", sa.Date(), nullable=True),
        sa.Column("requirements_complete", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("enrollment_remarks", sa.Text(), nullable=True),
        # Card tracking
        sa.Column(
            "virtual_card_status",
            sa.Enum("Not Available", "Available", "Sent to Employee", name="hmo_virtual_card_status"),
            nullable=False,
            server_default="Not Available",
        ),
        sa.Column("virtual_card_available_date", sa.Date(), nullable=True),
        sa.Column(
            "physical_card_status",
            sa.Enum(
                "Not Requested",
                "For Processing",
                "Ready for Release",
                "Received by HR",
                "Released to Employee",
                "Returned",
                "Lost",
                "Replacement Requested",
                name="hmo_physical_card_status",
            ),
            nullable=False,
            server_default="Not Requested",
        ),
        sa.Column("physical_card_received_by_hr_date", sa.Date(), nullable=True),
        sa.Column("physical_card_released_date", sa.Date(), nullable=True),
        sa.Column("physical_card_returned_date", sa.Date(), nullable=True),
        # Removal / offboarding
        sa.Column("removal_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "removal_status",
            sa.Enum(
                "Not Required", "Pending Endorsement", "Endorsed", "For Processing", "Removed",
                name="hmo_removal_status",
            ),
            nullable=False,
            server_default="Not Required",
        ),
        sa.Column("removal_endorsed_date", sa.Date(), nullable=True),
        sa.Column("inactive_date", sa.Date(), nullable=True),
        sa.Column(
            "inactive_reason",
            sa.Enum(
                "Resigned",
                "Terminated",
                "End of Contract",
                "Failed Eligibility",
                "Employee Request",
                "Other",
                name="hmo_inactive_reason",
            ),
            nullable=True,
        ),
        sa.Column("removal_remarks", sa.Text(), nullable=True),
        sa.Column(
            "updated_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_hmo_members_member_type", "hmo_members", ["member_type"])
    op.create_index("ix_hmo_members_employee_id", "hmo_members", ["employee_id"])
    op.create_index("ix_hmo_members_principal_member_id", "hmo_members", ["principal_member_id"])
    op.create_index("ix_hmo_members_enrollment_status", "hmo_members", ["enrollment_status"])

    op.create_table(
        "hmo_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hmo_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("request_type", sa.String(length=100), nullable=False),
        sa.Column(
            "status",
            sa.Enum("Pending", "Approved", "Rejected", name="hmo_request_status"),
            nullable=False,
            server_default="Pending",
        ),
        sa.Column("submitted_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "resolved_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_hmo_requests_member_id", "hmo_requests", ["member_id"])

    op.create_table(
        "hmo_billing_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("provider_invoice_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("month", name="uq_hmo_billing_periods_month"),
    )


def downgrade() -> None:
    op.drop_table("hmo_billing_periods")
    op.drop_table("hmo_requests")
    op.drop_table("hmo_members")

    for enum_name in (
        "hmo_member_type",
        "hmo_employment_status",
        "hmo_manager_evaluation",
        "hmo_relationship",
        "hmo_member_status",
        "hmo_billing_status",
        "hmo_enrollment_status",
        "hmo_virtual_card_status",
        "hmo_physical_card_status",
        "hmo_removal_status",
        "hmo_inactive_reason",
        "hmo_request_status",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
