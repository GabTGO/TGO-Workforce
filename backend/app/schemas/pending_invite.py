import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.account import AccountRole


class PendingInviteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: AccountRole
    invited_by_label: str
    created_at: datetime


class PendingInviteCreate(BaseModel):
    """Backs `POST /accounts/invites` — pre-assigns a role to an email that
    hasn't signed in yet. See app/models/pending_invite.py for how it's
    consumed at first sign-in."""

    email: EmailStr
    role: AccountRole
