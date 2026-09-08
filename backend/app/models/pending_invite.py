"""Pre-provisioned accounts — see PendingInvite.

Account rows are normally only ever created by the Zoho OAuth login flow
(app/api/routes/auth.py's zoho_callback), and every brand-new one defaults to
AccountRole.VIEWER. PendingInvite is how an admin sets a role *before* that
person has ever signed in: `POST /accounts/invites` (see
app/api/routes/accounts.py) records an email + role pair, and the next time
someone signs in via Zoho with a matching email, zoho_callback consumes the
matching row — the new Account gets that role instead of the VIEWER default —
and deletes it. Nothing here sends an email or any other notification; the
app has no outbound-mail integration, so the admin still has to tell that
person out-of-band to go sign in.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.account import AccountRole


class PendingInvite(Base):
    __tablename__ = "pending_invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Always stored lowercased (see accounts.py's create_invite) so a lookup
    # against Zoho's Email claim at login time — which can vary in case from
    # however the admin typed it here — still matches.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # Reuses the same Postgres enum type as Account.role (see the
    # values_callable comment there) rather than creating a second one.
    role: Mapped[AccountRole] = mapped_column(
        Enum(
            AccountRole,
            name="account_role",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            create_type=False,
        ),
        nullable=False,
    )

    # Nullable + ON DELETE SET NULL, same reasoning as ActivityLog.account_id
    # — this row shouldn't disappear or start referencing a stale id just
    # because the inviting admin's account is later deactivated. invited_by_
    # label snapshots who it was at invite time, same pattern as
    # ActivityLog.actor_label, so the Pending Invites list still reads
    # correctly even then.
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL")
    )
    invited_by_label: Mapped[str] = mapped_column(String(200), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
