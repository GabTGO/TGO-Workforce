import uuid
from urllib.parse import parse_qs, urlparse

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal, Base, engine
from app.main import app

# Ensures every model module runs (and therefore registers on Base.metadata)
# before _create_schema below — same reasoning as alembic/env.py.
from app.models import *  # noqa: F401,F403
from app.models.account import Account, AccountRole
from app.services import zoho


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
    """A raw, signed-out ASGI client. Use this for the tests that check the
    signed-out (401) or wrong-role (403) paths — most route tests want
    `admin_client` below instead, since /employees, /activity-logs and
    /accounts all require a signed-in account now."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _admin_client_zoho_settings():
    """Same shape as test_auth.py's `_zoho_settings` — kept separate (rather
    than imported) since a **kwargs-free zero-arg function is required here
    too: FastAPI inspects a dependency override's own signature to build its
    params, so **kwargs gets mistaken for a required query parameter."""
    return get_settings().model_copy(
        update={
            "zoho_client_id": "test-client-id",
            "zoho_client_secret": "test-client-secret",
            "zoho_redirect_uri": "http://backend.test/auth/zoho/callback",
            "frontend_url": "http://frontend.test",
        }
    )


@pytest_asyncio.fixture
async def admin_client(client, db_session, monkeypatch):
    """A `client` signed in (via a mocked Zoho login) as a fresh account,
    promoted to admin — what almost every /employees, /activity-logs and
    /accounts test wants now that those routers require a signed-in (accounts:
    admin) caller."""
    app.dependency_overrides[get_settings] = _admin_client_zoho_settings

    async def fake_exchange_code_for_token(settings, code):
        return {"access_token": "fake-access-token"}

    async def fake_fetch_user_info(access_token):
        unique = uuid.uuid4().hex[:8]
        return {
            "ZUID": f"zuid-admin-{unique}",
            "Email": f"admin-{unique}@tgo.internal",
            "First_Name": "Test",
            "Last_Name": "Admin",
            "Display_Name": "Test Admin",
        }

    monkeypatch.setattr(zoho, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(zoho, "fetch_user_info", fake_fetch_user_info)

    login = await client.get("/auth/zoho/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    await client.get(
        "/auth/zoho/callback",
        params={"code": "test-code", "state": state},
        follow_redirects=False,
    )
    app.dependency_overrides.pop(get_settings, None)

    me = (await client.get("/auth/me")).json()
    result = await db_session.execute(select(Account).where(Account.id == me["id"]))
    account = result.scalar_one()
    account.role = AccountRole.ADMIN
    await db_session.commit()

    yield client


@pytest_asyncio.fixture
async def viewer_client(client, monkeypatch):
    """A `client` signed in (via a mocked Zoho login) as a fresh account, left
    at the default "viewer" role — for tests that check the insufficient-role
    (403) path on admin-only routes."""
    app.dependency_overrides[get_settings] = _admin_client_zoho_settings

    async def fake_exchange_code_for_token(settings, code):
        return {"access_token": "fake-access-token"}

    async def fake_fetch_user_info(access_token):
        unique = uuid.uuid4().hex[:8]
        return {
            "ZUID": f"zuid-viewer-{unique}",
            "Email": f"viewer-{unique}@tgo.internal",
            "First_Name": "Test",
            "Last_Name": "Viewer",
            "Display_Name": "Test Viewer",
        }

    monkeypatch.setattr(zoho, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(zoho, "fetch_user_info", fake_fetch_user_info)

    login = await client.get("/auth/zoho/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    await client.get(
        "/auth/zoho/callback",
        params={"code": "test-code", "state": state},
        follow_redirects=False,
    )
    app.dependency_overrides.pop(get_settings, None)

    yield client
