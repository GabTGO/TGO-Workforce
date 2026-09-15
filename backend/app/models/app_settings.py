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

    # An alternative to Zoho Mail while the attendance team's Zoho Mail API
    # credentials aren't set up yet (see zoho_mail_* in app/core/config.py —
    # all empty by default). When on, POST /violations/{id}/send-now and
    # /bulk-send-now are replaced in the UI by a "send via your mail app"
    # flow: the approver opens the record's email in whatever's registered as
    # their default mail app (pre-filled via a mailto: link) and sends it
    # there themselves — see /violations/{id}/send-via-outlook (preps the
    # compose window, doesn't touch email_status) and the separate, explicit
    # /violations/{id}/mark-sent-via-outlook the approver clicks afterward to
    # actually mark it Sent (automation_result="manual_outlook") once they've
    # really sent it, since the app has no way to confirm what actually
    # happened in that mail app on its own. Named/routed for MS Outlook (who
    # this was originally built for), but a mailto: link isn't Outlook-
    # specific — it opens whichever app is the registered default handler,
    # which can just as easily be Zoho Mail itself (Zoho Mail has its own
    # "Mail To Handlers" setting to register for this — see
    # https://www.zoho.com/mail/help/defaultcomposer.html — so someone who
    # wants Zoho Mail instead of Outlook here doesn't need a code change).
    # Off by default (today's behavior: send-now/bulk-send-now call Zoho Mail
    # directly).
    use_outlook_for_violations: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
