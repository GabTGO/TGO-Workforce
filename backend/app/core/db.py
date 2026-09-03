"""Async SQLAlchemy engine/session setup, shared by the app and Alembic."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.async_database_url,
    pool_pre_ping=True,
    echo=settings.environment == "development",
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """Shared declarative base — every model in app/models inherits from this."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a request-scoped DB session and always closes it."""
    async with AsyncSessionLocal() as session:
        yield session
