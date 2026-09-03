import uuid

import pytest

from app.models.account import Account, AccountRole


@pytest.mark.asyncio
async def test_get_account(client, db_session) -> None:
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

    response = await client.get(f"/accounts/{account.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "jane.doe@tgo.internal"
    assert body["role"] == "people_ops"
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_list_accounts_includes_created(client, db_session) -> None:
    account = Account(
        zoho_user_id="zuid-test-2",
        email="ramon.cruz@tgo.internal",
        role=AccountRole.ADMIN,
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    response = await client.get("/accounts")

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()]
    assert "ramon.cruz@tgo.internal" in emails


@pytest.mark.asyncio
async def test_get_account_not_found(client) -> None:
    response = await client.get(f"/accounts/{uuid.uuid4()}")
    assert response.status_code == 404
