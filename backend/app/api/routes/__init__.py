from fastapi import APIRouter

from app.api.routes import (
    accounts,
    activity_logs,
    auth,
    employees,
    health,
    new_hires,
    notifications,
    violation_analytics,
    violation_import_export,
    violation_reports,
    violations,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(activity_logs.router)
api_router.include_router(employees.router)
api_router.include_router(new_hires.router)
api_router.include_router(notifications.router)
api_router.include_router(violations.router)
api_router.include_router(violation_reports.router)
api_router.include_router(violation_analytics.router)
api_router.include_router(violation_import_export.router)
