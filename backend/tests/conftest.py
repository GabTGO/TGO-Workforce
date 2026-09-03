import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.db import AsyncSessionLocal, Base, engine
from app.main import app

# Ensures every model module runs (and therefore registers on Base.metadata)
# before _create_schema below — same reasoning as alembic/env.py.
from app.models import *  # noqa: F401,F403


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_schema():
    # drop_all before create_all too: guards against stale tables/rows left
    # behind by a previous run that crashed before its own teardown ran.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
