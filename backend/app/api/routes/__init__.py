from fastapi import APIRouter

from app.api.routes import accounts, activity_logs, auth, employees, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(activity_logs.router)
api_router.include_router(employees.router)
