from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="TGO Workforce API",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Backs the signed, httpOnly session cookie the Zoho login flow sets
# (app/api/routes/auth.py) and app.core.auth.get_current_account reads.
# Frontend and backend are separate origins (different Railway domains), so in
# production the cookie has to be SameSite=None + Secure to survive that
# cross-site fetch at all; locally, over http, "lax" + non-secure is fine.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie=settings.session_cookie_name,
    max_age=settings.session_max_age_seconds,
    same_site="none" if settings.is_production else "lax",
    https_only=settings.is_production,
)

app.include_router(api_router)
