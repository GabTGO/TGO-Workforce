import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.activity_log import ActivityCategory, ActivitySeverity


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: uuid.UUID | None
    actor_label: str
    action: str
    target: str | None
    category: ActivityCategory
    severity: ActivitySeverity
    details: dict[str, Any] | None
    created_at: datetime
