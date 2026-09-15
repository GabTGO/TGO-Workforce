"""A single-row table storing the editable Department/Position suggestion
lists shown in the Edit Employee dialog's combobox (see
src/components/manage-employees-dialog.tsx's CreatableComboboxField).
Employee.department/position (app/models/employee.py) stay plain free-text
on the employee record itself — this table is only the *suggestions*
offered when picking a value, shared org-wide for every admin. Renaming or
removing an entry here never touches any employee already using that value;
it only changes what's offered going forward (see
app/api/routes/list_options.py).

Always exactly one row (id=1); see app/services/list_options.py for the
get-or-create accessor every reader and writer goes through, same pattern as
app/models/app_settings.py's AppSettings.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class ListOptions(Base):
    __tablename__ = "list_options"
    __table_args__ = (CheckConstraint("id = 1", name="list_options_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)

    departments: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    positions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
