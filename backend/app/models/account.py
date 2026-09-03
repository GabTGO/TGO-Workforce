"""The Account table — one row per person who can sign in to the portal.

Populated by the Zoho OAuth login flow (upsert-on-login, matched by
zoho_user_id), not by a public "create account" endpoint — there isn't one on
purpose. See app/api/routes/accounts.py.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.activity_log import ActivityLog


class AccountRole(enum.StrEnum):
    """Assumption: a single role per account, matching the roles already implied by
    the login page copy ("People Ops and Hub Leads") and the DESIGN_SYSTEM.md
    `adminOnly` nav pattern. Easy to widen to a many-to-many roles table later if
    one account ever needs more than one role — say if that changes.
    """

    ADMIN = "admin"
    PEOPLE_OPS = "people_ops"
    HUB_LEAD = "hub_lead"
    VIEWER = "viewer"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # --- Zoho OAuth / OpenID identity -----------------------------------------
    # zoho_user_id is Zoho's stable ZUID — the actual link between "this Zoho
    # login" and "this account", independent of email (which a person could
    # technically change on Zoho's side).
    zoho_user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    display_name: Mapped[str | None] = mapped_column(String(200))
    # Profile photo — a URL (Zoho's avatar endpoint, or later an uploaded image
    # in object storage), not a binary blob in Postgres.
    photo_url: Mapped[str | None] = mapped_column(String(500))

    role: Mapped[AccountRole] = mapped_column(
        # values_callable: persist the lowercase .value ("admin", not "ADMIN")
        # in the actual Postgres enum — SQLAlchemy defaults to the Python
        # member *name* otherwise, which would silently diverge from the
        # values the frontend/API already use everywhere else.
        Enum(
            AccountRole,
            name="account_role",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=AccountRole.VIEWER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    activity_logs: Mapped[list["ActivityLog"]] = relationship(back_populates="account")
