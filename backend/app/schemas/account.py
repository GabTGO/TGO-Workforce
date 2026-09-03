import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.account import AccountRole

Theme = Literal["light", "dark"]


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
    theme: Theme
    default_office: str | None
    notify_anniversaries: bool
    notify_birthdays: bool
    notify_new_hires: bool


class AccountUpdate(BaseModel):
    """Admin-editable fields — everything else (identity, Zoho linkage) is only
    ever set by the login flow itself."""

    display_name: str | None = None
    photo_url: str | None = None
    role: AccountRole | None = None
    is_active: bool | None = None


class AccountPreferencesUpdate(BaseModel):
    """Self-service personalization — backs PATCH /auth/me/preferences. Every
    field optional so a save only touches what actually changed, same pattern
    as EmployeeUpdate. Deliberately excludes role/is_active/display_name/
    photo_url: those are either admin-only (AccountUpdate) or Zoho-sourced."""

    theme: Theme | None = None
    default_office: str | None = None
    notify_anniversaries: bool | None = None
    notify_birthdays: bool | None = None
    notify_new_hires: bool | None = None
