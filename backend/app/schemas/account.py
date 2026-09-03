import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.account import AccountRole


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    zoho_user_id: str
    email: EmailStr
    first_name: str | None
    last_name: str | None
    display_name: str | None
    photo_url: str | None
    role: AccountRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AccountUpdate(BaseModel):
    """Admin-editable fields — everything else (identity, Zoho linkage) is only
    ever set by the login flow itself."""

    display_name: str | None = None
    photo_url: str | None = None
    role: AccountRole | None = None
    is_active: bool | None = None
