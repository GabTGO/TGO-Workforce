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
async def test_update_employee_can_rename_id(admin_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Rename Me", "start_date": "2026-01-01"}
    )
    old_id = create.json()["id"]

    update = await admin_client.patch(f"/employees/{old_id}", json={"id": "TGO-CUSTOM-1"})
    assert update.status_code == 200
    assert update.json()["id"] == "TGO-CUSTOM-1"

    assert (await admin_client.get(f"/employees/{old_id}")).status_code == 404
    assert (await admin_client.get("/employees/TGO-CUSTOM-1")).status_code == 200

    logs = await admin_client.get("/activity-logs", params={"category": "employee"})
    entry = next(row for row in logs.json() if row["target"] == "TGO-CUSTOM-1 · Rename Me")
    assert entry["details"]["id_changed_from"] == old_id


@pytest.mark.asyncio
async def test_update_employee_id_rejects_duplicate(admin_client) -> None:
    first = await admin_client.post(
        "/employees", json={"name": "First", "start_date": "2026-01-01"}
    )
    second = await admin_client.post(
        "/employees", json={"name": "Second", "start_date": "2026-01-01"}
    )
    first_id = first.json()["id"]
    second_id = second.json()["id"]

    response = await admin_client.patch(f"/employees/{second_id}", json={"id": first_id})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_employee_id_rejects_blank(admin_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Blank ID", "start_date": "2026-01-01"}
    )
    employee_id = create.json()["id"]

    response = await admin_client.patch(f"/employees/{employee_id}", json={"id": "   "})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_bulk_delete_employees(admin_client) -> None:
    ids = []
    for i in range(3):
        create = await admin_client.post(
            "/employees", json={"name": f"Bulk {i}", "start_date": "2026-01-01"}
        )
        ids.append(create.json()["id"])

    response = await admin_client.post("/employees/bulk-delete", json={"ids": ids})
    assert response.status_code == 200
    assert response.json() == {"deleted": 3, "not_found": []}

    for employee_id in ids:
        assert (await admin_client.get(f"/employees/{employee_id}")).status_code == 404

    logs = await admin_client.get("/activity-logs", params={"category": "employee"})
    assert any(row["action"] == "Bulk removed employee records" for row in logs.json())


@pytest.mark.asyncio
async def test_bulk_delete_reports_not_found_ids(admin_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Real Row", "start_date": "2026-01-01"}
    )
    real_id = create.json()["id"]

    response = await admin_client.post(
        "/employees/bulk-delete", json={"ids": [real_id, "TGO-NOPE"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == 1
    assert body["not_found"] == ["TGO-NOPE"]


@pytest.mark.asyncio
async def test_bulk_delete_empty_list_is_a_noop(admin_client) -> None:
    response = await admin_client.post("/employees/bulk-delete", json={"ids": []})
    assert response.status_code == 200
    assert response.json() == {"deleted": 0, "not_found": []}


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


# --- RBAC: viewer is read-only, people_ops/hub_lead have full employee CRUD ---
# Policy agreed 2026-09-03 — see app/core/auth.py's EMPLOYEE_WRITE_ROLES and
# src/lib/permissions.ts on the frontend.


@pytest.mark.asyncio
async def test_viewer_can_read_employees(viewer_client) -> None:
    """Read routes stay open to every signed-in role, including viewer."""
    response = await viewer_client.get("/employees")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_viewer_cannot_create_employee(viewer_client) -> None:
    response = await viewer_client.post(
        "/employees", json={"name": "Blocked Hire", "start_date": "2026-01-01"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_import_employees(viewer_client) -> None:
    response = await viewer_client.post(
        "/employees/import", json=[{"name": "Blocked Import", "start_date": "2026-01-01"}]
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_update_employee(admin_client, viewer_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Update Target", "start_date": "2026-01-01"}
    )
    employee_id = create.json()["id"]

    response = await viewer_client.patch(f"/employees/{employee_id}", json={"status": "Resigned"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_delete_employee(admin_client, viewer_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Delete Target", "start_date": "2026-01-01"}
    )
    employee_id = create.json()["id"]

    response = await viewer_client.delete(f"/employees/{employee_id}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_bulk_delete_employees(admin_client, viewer_client) -> None:
    create = await admin_client.post(
        "/employees", json={"name": "Bulk Target", "start_date": "2026-01-01"}
    )
    employee_id = create.json()["id"]

    response = await viewer_client.post("/employees/bulk-delete", json={"ids": [employee_id]})
    assert response.status_code == 403


async def _assert_full_employee_crud(writer_client) -> None:
    """Shared body for the people_ops/hub_lead RBAC tests below — both roles
    should behave exactly like admin for every employee write route: create,
    update, delete, bulk-delete, import."""
    create = await writer_client.post(
        "/employees", json={"name": "Writer Created", "start_date": "2026-01-01"}
    )
    assert create.status_code == 201
    employee_id = create.json()["id"]

    update = await writer_client.patch(f"/employees/{employee_id}", json={"status": "Resigned"})
    assert update.status_code == 200

    delete = await writer_client.delete(f"/employees/{employee_id}")
    assert delete.status_code == 204

    import_response = await writer_client.post(
        "/employees/import", json=[{"name": "Writer Imported", "start_date": "2026-01-01"}]
    )
    assert import_response.status_code == 200
    assert import_response.json()["added"] == 1

    directory = await writer_client.get("/employees", params={"q": "Writer Imported"})
    imported_id = directory.json()[0]["id"]

    bulk = await writer_client.post("/employees/bulk-delete", json={"ids": [imported_id]})
    assert bulk.status_code == 200
    assert bulk.json() == {"deleted": 1, "not_found": []}


@pytest.mark.asyncio
async def test_people_ops_has_full_employee_crud(people_ops_client) -> None:
    await _assert_full_employee_crud(people_ops_client)


@pytest.mark.asyncio
async def test_hub_lead_has_full_employee_crud(hub_lead_client) -> None:
    await _assert_full_employee_crud(hub_lead_client)
