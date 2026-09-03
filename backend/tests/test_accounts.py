import uuid

import pytest

from app.models.account import Account, AccountRole


@pytest.mark.asyncio
async def test_accounts_requires_sign_in(client) -> None:
    response = await client.get("/accounts")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_accounts_requires_admin_role(viewer_client) -> None:
    """A signed-in but non-admin account (the default for every new sign-in)
    gets 403, not the account list."""
    response = await viewer_client.get("/accounts")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_account(admin_client, db_session) -> None:
    account = Account(
        zoho_user_id="zuid-test-1",
        email="jane.doe@tgo.internal",
        first_name="Jane",
        last_name="Doe",
        role=AccountRole.PEOPLE_OPS,
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    response = await admin_client.get(f"/accounts/{account.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "jane.doe@tgo.internal"
    assert body["role"] == "people_ops"
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_list_accounts_includes_created(admin_client, db_session) -> None:
    account = Account(
        zoho_user_id="zuid-test-2",
        email="ramon.cruz@tgo.internal",
        role=AccountRole.ADMIN,
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    response = await admin_client.get("/accounts")

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()]
    assert "ramon.cruz@tgo.internal" in emails


@pytest.mark.asyncio
async def test_get_account_not_found(admin_client) -> None:
    response = await admin_client.get(f"/accounts/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_change_another_accounts_role(admin_client, db_session) -> None:
    target = Account(
        zoho_user_id="zuid-test-3",
        email="hub.lead@tgo.internal",
        role=AccountRole.VIEWER,
    )
    db_session.add(target)
    await db_session.commit()
    await db_session.refresh(target)

    response = await admin_client.patch(f"/accounts/{target.id}", json={"role": "hub_lead"})

    assert response.status_code == 200
    assert response.json()["role"] == "hub_lead"

    logs = await admin_client.get("/activity-logs", params={"category": "access"})
    assert any(row["target"] == "hub.lead@tgo.internal" for row in logs.json())


@pytest.mark.asyncio
async def test_admin_can_deactivate_another_account(admin_client, db_session) -> None:
    target = Account(
        zoho_user_id="zuid-test-4",
        email="deactivate.me@tgo.internal",
        role=AccountRole.VIEWER,
    )
    db_session.add(target)
    await db_session.commit()
    await db_session.refresh(target)

    response = await admin_client.patch(f"/accounts/{target.id}", json={"is_active": False})

    assert response.status_code == 200
    assert response.json()["is_active"] is False


@pytest.mark.asyncio
async def test_admin_cannot_demote_self(admin_client) -> None:
    me = (await admin_client.get("/auth/me")).json()

    response = await admin_client.patch(f"/accounts/{me['id']}", json={"role": "viewer"})

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_cannot_deactivate_self(admin_client) -> None:
    me = (await admin_client.get("/auth/me")).json()

    response = await admin_client.patch(f"/accounts/{me['id']}", json={"is_active": False})

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_account_not_found(admin_client) -> None:
    response = await admin_client.patch(f"/accounts/{uuid.uuid4()}", json={"role": "admin"})
    assert response.status_code == 404
