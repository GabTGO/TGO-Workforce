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

    # Placeholders for the Zoho OAuth integration — filled in once SSO is wired up.
    zoho_client_id: str | None = None
    zoho_client_secret: str | None = None
    zoho_redirect_uri: str | None = None

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
