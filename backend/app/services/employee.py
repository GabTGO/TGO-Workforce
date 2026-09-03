import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee


async def next_employee_id(db: AsyncSession) -> str:
    """Mirrors the frontend's nextEmployeeId() (src/data/employee-store.ts):
    highest numeric suffix among existing "TGO-####" ids, plus one, floored
    at 1001 so a from-scratch database doesn't start at TGO-1."""
    result = await db.execute(select(Employee.id))
    numbers = []
    for employee_id in result.scalars().all():
        digits = re.sub(r"\D", "", employee_id)
        if digits.isdigit():
            numbers.append(int(digits))

    highest = max(numbers, default=1000)
    return f"TGO-{highest + 1}"
