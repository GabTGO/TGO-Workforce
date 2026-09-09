from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NewHireBase(BaseModel):
    name: str
    role_title: str = ""
    start_date: str = ""
    recruitment_lead: str = ""
    onboarding_specialist: str = ""
    jo_discussion: bool = False
    confirmation_signed: bool = False
    welcome_email_sent: bool = False
    new_hire_info: bool = False
    id_photo: bool = False
    credentials_created: bool = False
    onboarding_day: bool = False


class NewHireCreate(NewHireBase):
    """Used by the Add New Hire dialog. completed_by is deliberately absent —
    it's always server-set (see app/api/routes/new_hires.py), never supplied
    by the client, matching the source app's auto-stamp rule."""


class NewHireUpdate(BaseModel):
    """Every field optional — a PATCH only touches what's actually sent, same
    shape as EmployeeUpdate. completed_by is still absent here: the route is
    the only place that ever writes it."""

    name: str | None = None
    role_title: str | None = None
    start_date: str | None = None
    recruitment_lead: str | None = None
    onboarding_specialist: str | None = None
    jo_discussion: bool | None = None
    confirmation_signed: bool | None = None
    welcome_email_sent: bool | None = None
    new_hire_info: bool | None = None
    id_photo: bool | None = None
    credentials_created: bool | None = None
    onboarding_day: bool | None = None


class NewHireRead(NewHireBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    completed_by: str | None = None
    created_at: datetime
    updated_at: datetime


class CliqNotifyRequest(BaseModel):
    """The frontend builds and previews this text (see
    src/lib/onboarding-notify.ts) before the person confirms sending it —
    this endpoint just relays it to Cliq verbatim, it doesn't rebuild it."""

    message: str
