import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.account import AccountRole
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
    # Safe to expose to every role regardless of reported_by_label above —
    # "is this my own card" never reveals anyone else's identity, only
    # whether the requester themselves is the reporter. This (or Super Admin)
    # is exactly the same rule that gates the reply thread — see
    # _can_access_thread in app/api/routes/feedback.py.
    is_own: bool = False
    comment_count: int = 0


class FeedbackCommentCreate(BaseModel):
    """A message in a card's reply thread — text, an image, or both. Only the
    card's own reporter or a Super Admin may post (see _can_access_thread)."""

    message: str | None = None
    # A data: URL (base64) — see FeedbackComment.image_data's own comment for
    # why this is stored inline rather than in real object storage.
    image_data: str | None = None

    @model_validator(mode="after")
    def _require_message_or_image(self) -> "FeedbackCommentCreate":
        if not (self.message or "").strip() and not self.image_data:
            raise ValueError("A message needs text, an image, or both.")
        return self


class FeedbackCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    feedback_id: uuid.UUID
    author_label: str
    author_role: AccountRole
    message: str | None
    image_data: str | None
    created_at: datetime
    # emoji -> how many people reacted with it (counts only, not who — the
    # thread is already restricted to just the reporter + Super Admin, but
    # there's no reason to hand back raw account ids here on top of that).
    reaction_counts: dict[str, int] = {}
    # Which emojis *this* requester has personally reacted with — lets the
    # frontend render a reaction button as "already toggled on" without
    # having to separately track that itself.
    my_reactions: list[str] = []


class FeedbackReactionToggle(BaseModel):
    emoji: str
