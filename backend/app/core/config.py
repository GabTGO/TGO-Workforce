"""Application settings, read from environment variables (and a local .env in dev).

Railway injects DATABASE_URL automatically once a Postgres plugin is attached and
linked to this service; locally, copy .env.example to .env and fill it in.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # Railway (and most managed Postgres providers) hand out a `postgres://` or
    # `postgresql://` URL. SQLAlchemy's async engine needs the `+asyncpg` driver
    # in the scheme, so `async_database_url` below rewrites it — always use that
    # property when building the engine, never `database_url` directly.
    database_url: str = "postgresql://postgres:postgres@localhost:5432/tgo_workforce"

    # Comma-separated list of allowed frontend origins, e.g.
    # "http://localhost:3000,https://tgo-workforce.up.railway.app"
    cors_origins: str = "http://localhost:3000"

    secret_key: str = "change-me-in-production"

    # Where the Zoho login flow (and logout) sends the browser back to. In
    # Railway, set this to the frontend service's public domain.
    frontend_url: str = "http://localhost:3000"

    # Session cookie — set by /auth/zoho/callback on a successful login, read
    # by app.core.auth.get_current_account on every request after that.
    session_cookie_name: str = "tgo_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 7  # 7 days

    # Zoho OAuth client — from https://api-console.zoho.com. Sign-in is
    # disabled (503) until all three are set.
    zoho_client_id: str | None = None
    zoho_client_secret: str | None = None
    zoho_redirect_uri: str | None = None

    # Comma-separated list of email addresses that are always promoted to
    # admin on Zoho sign-in (see app/api/routes/auth.py). This is the one way
    # to bootstrap the very first admin account without touching the
    # database directly — every other account starts as VIEWER and gets
    # promoted from the User Management page by an existing admin.
    zoho_admin_emails: str = ""

    @property
    def zoho_configured(self) -> bool:
        return bool(self.zoho_client_id and self.zoho_client_secret and self.zoho_redirect_uri)

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.zoho_admin_emails.split(",") if e.strip()}

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
