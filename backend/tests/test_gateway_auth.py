"""TGO Gateway mode (GATEWAY_URL set): the Gateway decides who is signed in and
may open TGO Workforce; this app keeps its own Account, role and session.

The Gateway itself is faked at app.core.gateway._ask_gateway, keyed by the
session token the test client carries in the shared Gateway cookie."""

import functools
import json
import uuid

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.core import gateway
from app.core.config import get_settings
from app.main import app
from app.models.account import Account, AccountRole
from app.models.session import AccountSession

GATEWAY = "https://gateway.test"
COOKIE = "tgo_gateway_session"


def _gateway_settings():
    # Zero-arg on purpose: see _zoho_settings in test_auth.py.
    return get_settings().model_copy(
        update={"gateway_url": GATEWAY + "/", "frontend_url": "https://workforce.test"}
    )


@pytest_asyncio.fixture
async def fake_gateway(monkeypatch):
    """token -> GatewayResult the fake Gateway answers with. A token not in the
    map is an expired / unknown Gateway session (401)."""
    answers: dict[str, gateway.GatewayResult] = {}

    async def fake_ask(token, settings):
        return answers.get(token, gateway.GatewayResult("unauthenticated"))

    monkeypatch.setattr(gateway, "_ask_gateway", fake_ask)
    app.dependency_overrides[get_settings] = _gateway_settings
    gateway.clear_verify_cache()
    yield answers
    gateway.clear_verify_cache()
    app.dependency_overrides.pop(get_settings, None)


def _allow(answers, email: str) -> str:
    token = f"tok-{uuid.uuid4().hex}"
    answers[token] = gateway.GatewayResult(
        "ok",
        gateway.GatewayProfile(
            user_id=uuid.uuid4().hex, email=email, name="Test Person", role="HR"
        ),
    )
    return token


def _client(token: str | None = None) -> AsyncClient:
    ac = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    if token:
        ac.cookies.set(COOKIE, token)
    return ac


def _email() -> str:
    return f"gw-{uuid.uuid4().hex[:8]}@tgocorp.com"


@pytest.mark.asyncio
async def test_signed_out_fails_closed_and_points_at_gateway(fake_gateway) -> None:
    async with _client() as ac:
        assert (await ac.get("/auth/me")).json() is None
        assert (await ac.get("/employees")).status_code == 401

        body = (await ac.get("/auth/status")).json()
    assert body["mode"] == "gateway"
    assert body["status"] == "signed_out"
    assert body["login_url"] == f"{GATEWAY}/login?next=https%3A%2F%2Fworkforce.test%2F"
    assert body["logout_url"] == f"{GATEWAY}/auth/logout"


@pytest.mark.asyncio
async def test_expired_gateway_cookie_is_signed_out(fake_gateway) -> None:
    async with _client("tok-not-known-to-gateway") as ac:
        assert (await ac.get("/employees")).status_code == 401


@pytest.mark.asyncio
async def test_first_visit_creates_viewer_and_one_session(fake_gateway, db_session) -> None:
    email = _email()
    token = _allow(fake_gateway, email)
    async with _client(token) as ac:
        me = (await ac.get("/auth/me")).json()
        assert me["email"] == email
        assert me["role"] == AccountRole.VIEWER.value
        assert (await ac.get("/employees")).status_code == 200
        assert (await ac.get("/auth/me")).json()["id"] == me["id"]
        assert (await ac.get("/auth/status")).json()["status"] == "signed_in"

    count = await db_session.scalar(
        select(func.count())
        .select_from(AccountSession)
        .where(AccountSession.account_id == me["id"])
    )
    assert count == 1


@pytest.mark.asyncio
async def test_existing_zoho_account_is_matched_by_email_and_keeps_its_role(
    fake_gateway, db_session
) -> None:
    email = _email()
    db_session.add(
        Account(zoho_user_id=f"zuid-{uuid.uuid4().hex}", email=email.upper(), role=AccountRole.HR)
    )
    await db_session.commit()

    async with _client(_allow(fake_gateway, email)) as ac:
        me = (await ac.get("/auth/me")).json()
    assert me["role"] == AccountRole.HR.value
    assert me["email"].lower() == email


@pytest.mark.asyncio
async def test_not_granted_in_gateway_is_denied(fake_gateway) -> None:
    fake_gateway["tok-denied"] = gateway.GatewayResult("denied")
    async with _client("tok-denied") as ac:
        response = await ac.get("/employees")
        assert response.status_code == 403
        assert "TGO Workforce" in response.json()["detail"]
        assert (await ac.get("/auth/status")).json()["status"] == "denied"


@pytest.mark.asyncio
async def test_gateway_down_fails_closed(fake_gateway) -> None:
    fake_gateway["tok-down"] = gateway.GatewayResult("unavailable")
    async with _client("tok-down") as ac:
        assert (await ac.get("/employees")).status_code == 503


@pytest.mark.asyncio
async def test_terminated_session_stays_ended_until_a_new_gateway_sign_in(
    fake_gateway, db_session
) -> None:
    email = _email()
    token = _allow(fake_gateway, email)
    async with _client(token) as ac:
        me = (await ac.get("/auth/me")).json()
        account_session = (
            await db_session.execute(
                select(AccountSession).where(AccountSession.account_id == me["id"])
            )
        ).scalar_one()
        account_session.revoked_at = func.now()
        await db_session.commit()

        assert (await ac.get("/employees")).status_code == 401
        assert (await ac.get("/auth/status")).json()["status"] == "ended"

        # Signing out of the Gateway and back in hands the browser a new token.
        ac.cookies.set(COOKIE, _allow(fake_gateway, email))
        assert (await ac.get("/auth/me")).json()["id"] == me["id"]


@pytest.mark.asyncio
async def test_zoho_login_hands_off_to_gateway(fake_gateway) -> None:
    async with _client() as ac:
        login = await ac.get("/auth/zoho/login", follow_redirects=False)
        assert login.status_code in (302, 307)
        assert login.headers["location"].startswith(f"{GATEWAY}/login?next=")
        callback = await ac.get("/auth/zoho/callback", params={"code": "x", "state": "y"})
        assert callback.status_code == 404


@pytest.mark.asyncio
async def test_ask_gateway_forwards_cookie_and_tool_id(monkeypatch) -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["cookie"] = request.headers.get("cookie")
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "allowed": True,
                "userId": "u1",
                "email": "A.Person@TGOcorp.com",
                "name": "A Person",
            },
        )

    monkeypatch.setattr(
        gateway.httpx,
        "AsyncClient",
        functools.partial(httpx.AsyncClient, transport=httpx.MockTransport(handler)),
    )
    result = await gateway._ask_gateway("abc.def", _gateway_settings())

    assert seen == {
        "url": f"{GATEWAY}/api/auth/verify",
        "cookie": f"{COOKIE}=abc.def",
        "body": {"toolId": "workforce"},
    }
    assert result.status == "ok"
    assert result.profile.email == "a.person@tgocorp.com"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("code", "expected"), [(401, "unauthenticated"), (403, "denied"), (502, "unavailable")]
)
async def test_ask_gateway_maps_status_codes(monkeypatch, code, expected) -> None:
    monkeypatch.setattr(
        gateway.httpx,
        "AsyncClient",
        functools.partial(
            httpx.AsyncClient, transport=httpx.MockTransport(lambda r: httpx.Response(code))
        ),
    )
    assert (await gateway._ask_gateway("t", _gateway_settings())).status == expected
