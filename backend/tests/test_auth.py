from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.main import app
from app.models.account import Account
from app.services import zoho


def _zoho_settings():
    """A Settings instance with Zoho "configured", for tests that need the
    login/callback routes to actually behave as if credentials were set.

    Takes no arguments on purpose — FastAPI inspects a dependency override's
    own signature to build its params, so a **kwargs signature here gets
    mistaken for a required query parameter on every route using it.
    """
    return get_settings().model_copy(
        update={
            "zoho_client_id": "test-client-id",
            "zoho_client_secret": "test-client-secret",
            "zoho_redirect_uri": "http://backend.test/auth/zoho/callback",
            "frontend_url": "http://frontend.test",
        }
    )


@pytest.fixture
def zoho_configured():
    app.dependency_overrides[get_settings] = _zoho_settings
    yield
    app.dependency_overrides.pop(get_settings, None)


@pytest.mark.asyncio
async def test_zoho_login_not_configured_by_default(client) -> None:
    response = await client.get("/auth/zoho/login")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_zoho_login_redirects_to_zoho(client, zoho_configured) -> None:
    response = await client.get("/auth/zoho/login", follow_redirects=False)

    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith("https://accounts.zoho.com/oauth/v2/auth")
    query = parse_qs(urlparse(location).query)
    assert query["client_id"] == ["test-client-id"]
    assert query["redirect_uri"] == ["http://backend.test/auth/zoho/callback"]
    assert "state" in query


@pytest.mark.asyncio
async def test_me_when_signed_out(client) -> None:
    response = await client.get("/auth/me")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_zoho_callback_rejects_bad_state(client, zoho_configured) -> None:
    response = await client.get(
        "/auth/zoho/callback",
        params={"code": "whatever", "state": "not-the-real-state"},
        follow_redirects=False,
    )

    assert response.status_code in (302, 307)
    assert response.headers["location"] == "http://frontend.test/login?error=zoho"


@pytest.mark.asyncio
async def test_zoho_login_flow_creates_account_and_signs_in(
    client, db_session, zoho_configured, monkeypatch
) -> None:
    async def fake_exchange_code_for_token(settings, code):
        assert code == "auth-code-123"
        return {"access_token": "fake-access-token"}

    async def fake_fetch_user_info(access_token):
        assert access_token == "fake-access-token"
        return {
            "ZUID": "zuid-new-1",
            "Email": "new.hire@tgo.internal",
            "First_Name": "New",
            "Last_Name": "Hire",
            "Display_Name": "New Hire",
        }

    monkeypatch.setattr(zoho, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(zoho, "fetch_user_info", fake_fetch_user_info)

    login_response = await client.get("/auth/zoho/login", follow_redirects=False)
    state = parse_qs(urlparse(login_response.headers["location"]).query)["state"][0]

    callback_response = await client.get(
        "/auth/zoho/callback",
        params={"code": "auth-code-123", "state": state},
        follow_redirects=False,
    )
    assert callback_response.status_code in (302, 307)
    assert callback_response.headers["location"] == "http://frontend.test"

    me_response = await client.get("/auth/me")
    assert me_response.status_code == 200
    body = me_response.json()
    assert body is not None
    assert body["email"] == "new.hire@tgo.internal"
    assert body["role"] == "viewer"  # default for a brand-new account

    # Signing in again with the same ZUID updates the existing row rather
    # than creating a second one.
    login_response_2 = await client.get("/auth/zoho/login", follow_redirects=False)
    state_2 = parse_qs(urlparse(login_response_2.headers["location"]).query)["state"][0]
    await client.get(
        "/auth/zoho/callback",
        params={"code": "auth-code-123", "state": state_2},
        follow_redirects=False,
    )
    # /accounts is admin-only now (this account is a viewer), so check
    # uniqueness directly against the database instead.
    result = await db_session.execute(select(Account).where(Account.zoho_user_id == "zuid-new-1"))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_zoho_login_promotes_admin_allowlisted_email(
    client, db_session, monkeypatch
) -> None:
    """ZOHO_ADMIN_EMAILS is the one bootstrap path to a first admin account —
    a matching email gets promoted to admin right on sign-in, no database
    access required."""

    def _settings_with_admin_allowlist():
        return get_settings().model_copy(
            update={
                "zoho_client_id": "test-client-id",
                "zoho_client_secret": "test-client-secret",
                "zoho_redirect_uri": "http://backend.test/auth/zoho/callback",
                "frontend_url": "http://frontend.test",
                "zoho_admin_emails": "boss@tgo.internal, other@tgo.internal",
            }
        )

    app.dependency_overrides[get_settings] = _settings_with_admin_allowlist

    async def fake_exchange_code_for_token(settings, code):
        return {"access_token": "fake-access-token"}

    async def fake_fetch_user_info(access_token):
        return {"ZUID": "zuid-boss-1", "Email": "Boss@TGO.internal"}

    monkeypatch.setattr(zoho, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(zoho, "fetch_user_info", fake_fetch_user_info)

    login_response = await client.get("/auth/zoho/login", follow_redirects=False)
    state = parse_qs(urlparse(login_response.headers["location"]).query)["state"][0]
    await client.get(
        "/auth/zoho/callback",
        params={"code": "auth-code-boss", "state": state},
        follow_redirects=False,
    )
    app.dependency_overrides.pop(get_settings, None)

    me_response = await client.get("/auth/me")
    assert me_response.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_logout_clears_session(client, db_session, zoho_configured, monkeypatch) -> None:
    async def fake_exchange_code_for_token(settings, code):
        return {"access_token": "fake-access-token"}

    async def fake_fetch_user_info(access_token):
        return {"ZUID": "zuid-logout-1", "Email": "logout.test@tgo.internal"}

    monkeypatch.setattr(zoho, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(zoho, "fetch_user_info", fake_fetch_user_info)

    login_response = await client.get("/auth/zoho/login", follow_redirects=False)
    state = parse_qs(urlparse(login_response.headers["location"]).query)["state"][0]
    await client.get(
        "/auth/zoho/callback",
        params={"code": "code-2", "state": state},
        follow_redirects=False,
    )
    assert (await client.get("/auth/me")).json() is not None

    logout_response = await client.post("/auth/logout")
    assert logout_response.status_code == 204

    assert (await client.get("/auth/me")).json() is None
