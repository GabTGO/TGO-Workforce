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
        email="hr.person@tgo.internal",
        role=AccountRole.VIEWER,
    )
    db_session.add(target)
    await db_session.commit()
    await db_session.refresh(target)

    response = await admin_client.patch(f"/accounts/{target.id}", json={"role": "hr"})

    assert response.status_code == 200
    assert response.json()["role"] == "hr"

    logs = await admin_client.get("/activity-logs", params={"category": "access"})
    assert any(row["target"] == "hr.person@tgo.internal" for row in logs.json())


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


# --- Pending invites (POST /accounts/invites) --------------------------------
# Lets an admin pre-assign a role to an email that hasn't signed in yet — see
# app/models/pending_invite.py and test_zoho_login_consumes_pending_invite in
# test_auth.py for the consuming side of this at first sign-in.


@pytest.mark.asyncio
async def test_invites_requires_admin_role(viewer_client) -> None:
    response = await viewer_client.get("/accounts/invites")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_invite(admin_client) -> None:
    response = await admin_client.post(
        "/accounts/invites", json={"email": "Not.Yet.Signed.In@TGO.internal", "role": "people_ops"}
    )

    assert response.status_code == 201
    body = response.json()
    # Stored lowercased so it matches Zoho's Email claim at login regardless
    # of casing either side typed it with.
    assert body["email"] == "not.yet.signed.in@tgo.internal"
    assert body["role"] == "people_ops"
    assert body["invited_by_label"]

    logs = await admin_client.get("/activity-logs", params={"category": "access"})
    assert any(row["action"] == "Invited user" for row in logs.json())


@pytest.mark.asyncio
async def test_list_invites_includes_created(admin_client) -> None:
    await admin_client.post(
        "/accounts/invites", json={"email": "future.viewer@tgo.internal", "role": "viewer"}
    )

    response = await admin_client.get("/accounts/invites")

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()]
    assert "future.viewer@tgo.internal" in emails


@pytest.mark.asyncio
async def test_create_invite_rejects_already_signed_in_email(admin_client, db_session) -> None:
    existing = Account(
        zoho_user_id="zuid-already-signed-in",
        email="already.here@tgo.internal",
        role=AccountRole.VIEWER,
    )
    db_session.add(existing)
    await db_session.commit()

    response = await admin_client.post(
        "/accounts/invites", json={"email": "already.here@tgo.internal", "role": "admin"}
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_invite_twice_updates_role_instead_of_erroring(admin_client) -> None:
    first = await admin_client.post(
        "/accounts/invites", json={"email": "typo.role@tgo.internal", "role": "viewer"}
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = await admin_client.post(
        "/accounts/invites", json={"email": "typo.role@tgo.internal", "role": "hr"}
    )

    assert second.status_code == 201
    assert second.json()["id"] == first_id
    assert second.json()["role"] == "hr"

    # Still just one row, not a duplicate.
    listing = await admin_client.get("/accounts/invites")
    matches = [row for row in listing.json() if row["email"] == "typo.role@tgo.internal"]
    assert len(matches) == 1


@pytest.mark.asyncio
async def test_revoke_invite(admin_client) -> None:
    create = await admin_client.post(
        "/accounts/invites", json={"email": "changed.mind@tgo.internal", "role": "people_ops"}
    )
    invite_id = create.json()["id"]

    response = await admin_client.delete(f"/accounts/invites/{invite_id}")
    assert response.status_code == 204

    listing = await admin_client.get("/accounts/invites")
    assert all(row["id"] != invite_id for row in listing.json())


@pytest.mark.asyncio
async def test_revoke_invite_not_found(admin_client) -> None:
    response = await admin_client.delete(f"/accounts/invites/{uuid.uuid4()}")
    assert response.status_code == 404
