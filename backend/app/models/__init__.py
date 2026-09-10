# SQLAlchemy models, one module per table. Each new model module must be
# imported here so Base.metadata (and therefore Alembic autogenerate) picks it
# up — see the comment in alembic/env.py.

from app.models.account import Account, AccountRole
from app.models.activity_log import ActivityCategory, ActivityLog, ActivitySeverity
from app.models.employee import Employee, EmployeeStatus
from app.models.new_hire import NewHire
from app.models.notification import Notification
from app.models.pending_invite import PendingInvite
from app.models.permission import Permission, RolePermission
from app.models.violation import (
    EmailStatus,
    ImportBatch,
    Office,
    ViolationRecord,
    ViolationType,
)

__all__ = [
    "Account",
    "AccountRole",
    "ActivityCategory",
    "ActivityLog",
    "ActivitySeverity",
    "EmailStatus",
    "Employee",
    "EmployeeStatus",
    "ImportBatch",
    "NewHire",
    "Notification",
    "Office",
    "PendingInvite",
    "Permission",
    "RolePermission",
    "ViolationRecord",
    "ViolationType",
]
