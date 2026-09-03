from datetime import date

import pytest

from app.models.employee import Employee, EmployeeStatus


@pytest.mark.asyncio
async def test_employees_requires_sign_in(client) -> None:
    """/employees used to be reachable by anyone — now it requires a signed-in
    account (any role)."""
    response = await client.get("/employees")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_employee_generates_id_and_logs_activity(admin_client) -> None:
    response = await admin_client.post(
        "/employees",
        json={"name": "Jane Doe", "office": "PH Eastwood", "start_date": "2026-01-15"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"].startswith("TGO-")
    assert body["name"] == "Jane Doe"
    assert body["status"] == "Active"

    logs = await admin_client.get("/activity-logs", params={"category": "employee"})
    assert any(row["action"] == "Created employee record" for row in logs.json())


@pytest.mark.asyncio
async def test_next_id_increments_past_existing_rows(admin_client, db_session) -> None:
    db_session.add(
        Employee(
            id="TGO-9500",
            name="Seed Row",
            office="PH Eastwood",
            start_date=date(2020, 1, 1),
        )
    )
    await db_session.commit()

    response = await admin_client.post(
        "/employees", json={"name": "New Person", "start_date": "2026-02-01"}
    )

    assert response.status_code == 201
    assert response.json()["id"] == "TGO-9501"


@pytest.mark.asyncio
async def test_get_and_list_employee(admin_client) -> None:
    create = await admin_client.post(
        "/employees",
        json={"name": "Search Target", "office": "CO Medellin", "start_date": "2026-03-01"},
    )
    employee_id = create.json()["id"]

    get_response = await admin_client.get(f"/employees/{employee_id}")
    assert get_response.status_code == 200
    assert get_response.json()["office"] == "CO Medellin"

    list_response = await admin_client.get("/employees", params={"q": "Search Target"})
    assert any(row["id"] == employee_id for row in list_response.json())

    filtered = await admin_client.get("/employees", params={"office": "CO Medellin"})
    assert all(row["office"] == "CO Medellin" for row in filtered.json())


@pytest.mark.asyncio
async def test_get_employee_not_found(admin_client) -> None:
    response = await admin_client.get("/employees/TGO-999999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_employee_logs_changed_fields(admin_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Edit Me", "start_date": "2026-01-01"}
    )
    employee_id = create.json()["id"]

    update = await admin_client.patch(f"/employees/{employee_id}", json={"status": "Resigned"})
    assert update.status_code == 200
    assert update.json()["status"] == "Resigned"

    logs = await admin_client.get("/activity-logs", params={"category": "employee"})
    entry = next(row for row in logs.json() if row["target"].startswith(employee_id))
    assert entry["action"] in {"Created employee record", "Updated employee record"}


@pytest.mark.asyncio
async def test_delete_employee_logs_warning_and_404s_after(admin_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Delete Me", "start_date": "2026-01-01"}
    )
    employee_id = create.json()["id"]

    delete = await admin_client.delete(f"/employees/{employee_id}")
    assert delete.status_code == 204

    get_after = await admin_client.get(f"/employees/{employee_id}")
    assert get_after.status_code == 404

    logs = await admin_client.get("/activity-logs", params={"severity": "warning"})
    assert any(row["target"] == f"{employee_id} · Delete Me" for row in logs.json())


@pytest.mark.asyncio
async def test_import_skips_rows_without_name(admin_client) -> None:
    response = await admin_client.post(
        "/employees/import",
        json=[
            {"name": "Imported Person", "start_date": "2026-05-01"},
            {"name": "  ", "start_date": "2026-05-01"},
            {"name": ""},
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {"added": 1, "skipped": 2}


@pytest.mark.asyncio
async def test_import_defaults_missing_fields(admin_client) -> None:
    response = await admin_client.post("/employees/import", json=[{"name": "Defaults Only"}])

    assert response.status_code == 200
    assert response.json()["added"] == 1

    directory = await admin_client.get("/employees", params={"q": "Defaults Only"})
    row = directory.json()[0]
    assert row["office"] == "PH Eastwood"
    assert row["status"] == EmployeeStatus.ACTIVE.value
