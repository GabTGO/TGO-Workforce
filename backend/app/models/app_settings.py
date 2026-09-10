"""A single-row table of app-wide settings a Super Admin controls at runtime
— distinct from app/core/config.py's Settings, which is env-var-backed and
only changes on redeploy. Always exactly one row (id=1); see
app/services/app_settings.py for the get-or-create accessor every reader and
writer goes through instead of querying this table directly.
"""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class AppSettings(Base):
    __tablename__ = "app_settings"
    __table_args__ = (CheckConstraint("id = 1", name="app_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)

    # When on, /auth/zoho/callback refuses to create a brand-new Account for
    # any email without a matching PendingInvite — existing accounts can
    # still sign in as always. Off by default (today's behavior: anyone with
    # a Zoho account in the org can sign in and starts as Viewer).
    invite_only_signup: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
