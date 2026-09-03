import pytest

from app.models.activity_log import ActivityCategory, ActivitySeverity
from app.services.activity_log import record_activity


@pytest.mark.asyncio
async def test_activity_logs_requires_sign_in(client) -> None:
    """/activity-logs used to be reachable by anyone — now it requires a
    signed-in account (any role)."""
    response = await client.get("/activity-logs")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_record_and_list_activity(admin_client, db_session) -> None:
    entry = await record_activity(
        db_session,
        action="Created employee record",
        category=ActivityCategory.EMPLOYEE,
        actor_label="Test Actor",
        target="TGO-9999 · Test Person",
        severity=ActivitySeverity.INFO,
    )
    assert entry.id is not None

    response = await admin_client.get("/activity-logs", params={"category": "employee"})

    assert response.status_code == 200
    rows = response.json()
    assert any(row["id"] == entry.id for row in rows)
    assert all(row["category"] == "employee" for row in rows)


@pytest.mark.asyncio
async def test_filter_by_severity(admin_client, db_session) -> None:
    await record_activity(
        db_session,
        action="Failed sign-in attempt",
        category=ActivityCategory.ACCESS,
        actor_label="Test Actor",
        severity=ActivitySeverity.CRITICAL,
    )

    response = await admin_client.get("/activity-logs", params={"severity": "info"})

    assert response.status_code == 200
    assert all(row["severity"] == "info" for row in response.json())


@pytest.mark.asyncio
async def test_record_activity_requires_actor_label_without_account(db_session) -> None:
    with pytest.raises(ValueError):
        await record_activity(
            db_session,
            action="Should fail",
            category=ActivityCategory.SYSTEM,
        )
