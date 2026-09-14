import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.feedback import FeedbackPriority, FeedbackStatus, FeedbackType


class FeedbackCreate(BaseModel):
    """Backs the "Report Feedback" dialog — open to any signed-in account.
    status always starts Pending (not settable here); priority defaults to
    Medium but the reporter may suggest a different one, same as a GitHub
    issue's initial label — a Super Admin can always re-triage it later."""

    type: FeedbackType
    title: str
    reason: str
    priority: FeedbackPriority = FeedbackPriority.MEDIUM


class FeedbackAdminUpdate(BaseModel):
    """Super-Admin-only: move a card between Kanban columns and/or re-triage
    its priority. Deliberately excludes type/title/reason — editing the
    substance of someone's report isn't part of triage."""

    status: FeedbackStatus | None = None
    priority: FeedbackPriority | None = None


class FeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: FeedbackType
    title: str
    reason: str
    status: FeedbackStatus
    priority: FeedbackPriority
    created_at: datetime
    updated_at: datetime
    # Populated only when the requesting account is Super Admin — every other
    # role gets these as null, not just omitted, so the shape is identical
    # either way and the frontend can't accidentally leak a value that was
    # meant to be hidden (see app/api/routes/feedback.py's _to_read()).
    reported_by_label: str | None = None
