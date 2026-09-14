from fastapi import APIRouter

from app.api.routes import (
    accounts,
    activity_logs,
    app_settings,
    auth,
    awards,
    employees,
    feedback,
    health,
    new_hires,
    notifications,
    permissions,
    violation_analytics,
    violation_import_export,
    violation_reports,
    violations,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(app_settings.router)
api_router.include_router(activity_logs.router)
api_router.include_router(employees.router)
api_router.include_router(awards.router)
api_router.include_router(feedback.router)
api_router.include_router(new_hires.router)
api_router.include_router(notifications.router)
api_router.include_router(permissions.router)
api_router.include_router(violations.router)
api_router.include_router(violation_reports.router)
api_router.include_router(violation_analytics.router)
api_router.include_router(violation_import_export.router)
