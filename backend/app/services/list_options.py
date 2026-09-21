"""Get-or-create accessor for the singleton ListOptions row (id=1) — every
reader and writer goes through this instead of querying the table directly,
same pattern as app/services/app_settings.py's get_app_settings.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list_options import ListOptions

LIST_OPTIONS_ID = 1

# Only ever used if the seeding migration somehow hasn't run yet (a fresh
# test database that skips migrations, etc.) — the migration
# (c4e8b1f2a6d7_create_list_options_table.py) is the real source of truth
# for what actually ships; this is just a safety net so a reader never 500s
# on a missing row, mirroring DEFAULT_GRANTS's own reasoning in
# app/services/permissions.py.
_DEFAULT_DEPARTMENTS = [
    "Dispatch",
    "Business Admin",
    "Recruitment",
    "Management",
    "Sales",
    "FHP",
    "Projects",
    "Payroll",
]
_DEFAULT_POSITIONS = [
    "L1 - Dispatcher",
    "L2 - Dispatcher",
    "Spanish Dispatcher",
    "Dispatch Lead",
    "Dispatch Supervisor",
    "Business Associate",
    "Recruitment Associate",
    "Talent Acquisition Lead",
    "Sales Representative",
    "US Payroll Specialists",
    "Payroll Associate",
    "FHP - VA",
    "FHP - Bid Coordinator",
    "Chief of Staff",
    "HR Transport",
    "Onboarding & Offboarding Specialist",
    "AI & Automations Lead",
    "Head of BA",
    "Head of Dispatch",
    "Head of HR",
    "Head of Projects & Payroll",
]
_DEFAULT_LEVELS = [
    "L1 - Associate",
    "L2 - Senior Associate",
    "L3 - Coordinator",
    "L4 - Senior Coordinator",
    "L5 - Specialist",
    "L6 - Captain",
    "L7 - Manager",
]


async def get_list_options(db: AsyncSession) -> ListOptions:
    options = await db.get(ListOptions, LIST_OPTIONS_ID)
    if options is not None:
        return options

    options = ListOptions(
        id=LIST_OPTIONS_ID,
        departments=list(_DEFAULT_DEPARTMENTS),
        positions=list(_DEFAULT_POSITIONS),
        levels=list(_DEFAULT_LEVELS),
    )
    db.add(options)
    try:
        await db.flush()
    except IntegrityError:
        # Lost a race with another request creating the same singleton row —
        # roll back this attempt and read back whatever won.
        await db.rollback()
        options = await db.get(ListOptions, LIST_OPTIONS_ID)
        assert options is not None
    return options
