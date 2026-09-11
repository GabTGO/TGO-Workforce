import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class AwardCreate(BaseModel):
    """Backs "Give an Award" — employee_id must point at an Active employee
    (the route 404s/400s otherwise); title/description are free text."""

    employee_id: str
    title: str
    description: str | None = None
    awarded_date: date


class AwardUpdate(BaseModel):
    """Every field optional — a PATCH only touches what's actually sent.
    Deliberately excludes employee_id: re-pointing an award at a different
    employee isn't a supported edit — delete and re-give it instead."""

    title: str | None = None
    description: str | None = None
    awarded_date: date | None = None


class AwardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: str
    employee_name: str
    employee_office: str
    title: str
    description: str | None
    awarded_date: date
    awarded_by_label: str
    created_at: datetime
    updated_at: datetime
