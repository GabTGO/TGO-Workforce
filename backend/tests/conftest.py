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


async def _signed_in_client(monkeypatch, label: str) -> AsyncClient:
    """Creates a brand-new ASGI client (its own cookie jar) and signs it in as
    a fresh account via a mocked Zoho login. Each role fixture below gets its
    own client here — rather than all sharing the one `client` fixture — so a
    test can depend on two roles at once (e.g. an admin_client to seed a row
    and a viewer_client to probe it) without the second login overwriting the
    first client's session cookie, which is what a shared client would do."""
    app.dependency_overrides[get_settings] = _admin_client_zoho_settings

    async def fake_exchange_code_for_token(settings, code):
        return {"access_token": "fake-access-token"}

    async def fake_fetch_user_info(access_token):
        unique = uuid.uuid4().hex[:8]
        return {
            "ZUID": f"zuid-{label}-{unique}",
            "Email": f"{label}-{unique}@tgo.internal",
            "First_Name": "Test",
            "Last_Name": label.title(),
            "Display_Name": f"Test {label.title()}",
        }

    monkeypatch.setattr(zoho, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(zoho, "fetch_user_info", fake_fetch_user_info)

    transport = ASGITransport(app=app)
    ac = AsyncClient(transport=transport, base_url="http://test")
    login = await ac.get("/auth/zoho/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    await ac.get(
        "/auth/zoho/callback",
        params={"code": "test-code", "state": state},
        follow_redirects=False,
    )
    app.dependency_overrides.pop(get_settings, None)
    return ac


async def _promote(db_session, ac: AsyncClient, role: AccountRole) -> None:
    me = (await ac.get("/auth/me")).json()
    result = await db_session.execute(select(Account).where(Account.id == me["id"]))
    account = result.scalar_one()
    account.role = role
    await db_session.commit()


@pytest_asyncio.fixture
async def admin_client(db_session, monkeypatch):
    """A signed-in (via a mocked Zoho login) fresh account, promoted to admin
    — what almost every /employees, /activity-logs and /accounts test wants
    now that those routers require a signed-in (accounts: admin) caller."""
    ac = await _signed_in_client(monkeypatch, "admin")
    await _promote(db_session, ac, AccountRole.ADMIN)
    try:
        yield ac
    finally:
        await ac.aclose()


@pytest_asyncio.fixture
async def people_ops_client(db_session, monkeypatch):
    """Same pattern as admin_client, promoted to people_ops — for tests
    confirming this role has full employee CRUD (create/edit/delete/import/
    bulk-delete) but not User Management."""
    ac = await _signed_in_client(monkeypatch, "people-ops")
    await _promote(db_session, ac, AccountRole.PEOPLE_OPS)
    try:
        yield ac
    finally:
        await ac.aclose()


@pytest_asyncio.fixture
async def hub_lead_client(db_session, monkeypatch):
    """Same pattern as admin_client, promoted to hub_lead — currently granted
    the same employee-write access as people_ops (see app/core/auth.py's
    EMPLOYEE_WRITE_ROLES and src/lib/permissions.ts on the frontend)."""
    ac = await _signed_in_client(monkeypatch, "hub-lead")
    await _promote(db_session, ac, AccountRole.HUB_LEAD)
    try:
        yield ac
    finally:
        await ac.aclose()


@pytest_asyncio.fixture
async def viewer_client(monkeypatch):
    """A signed-in (via a mocked Zoho login) fresh account, left at the
    default "viewer" role — for tests that check the insufficient-role (403)
    path on writer-only or admin-only routes."""
    ac = await _signed_in_client(monkeypatch, "viewer")
    try:
        yield ac
    finally:
        await ac.aclose()
