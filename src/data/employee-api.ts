// HTTP client for the /employees endpoints (backend/app/api/routes/employees.py),
// plus the mapping between the backend's snake_case row shape and the
// frontend's camelCase Employee type (@/data/employees). Kept in one place so
// every CRUD path — Directory, Manage Employees, New Hire form, Excel import —
// goes through the same shapes. @/data/employee-store wraps these in React
// Query hooks; components should use that, not this file, directly.

import { apiUrl } from "@/lib/api";
import type { Employee, EmployeeStatus } from "@/data/employees";

type BackendEmployee = {
  id: string;
  name: string;
  office: string;
  department: string;
  position: string;
  job_offer_date: string | null;
  start_date: string;
  status: EmployeeStatus;
  exit_date: string | null;
  birthday: string | null;
  source_type: string | null;
  created_at: string;
  updated_at: string;
};

function fromBackend(row: BackendEmployee): Employee {
  return {
    id: row.id,
    name: row.name,
    office: row.office,
    department: row.department,
    position: row.position,
    jobOfferDate: row.job_offer_date ?? undefined,
    startDate: row.start_date,
    status: row.status,
    exitDate: row.exit_date ?? undefined,
    birthday: row.birthday ?? "",
    sourceType: row.source_type ?? undefined,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include", // carries the Zoho session cookie, so writes attribute to the real signed-in account
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request to ${path} failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchEmployees(): Promise<Employee[]> {
  const rows = await request<BackendEmployee[]>("/employees?limit=1000");
  return rows.map(fromBackend);
}

export type NewEmployeeInput = {
  name: string;
  office?: string;
  department?: string;
  position?: string;
  jobOfferDate?: string;
  startDate: string;
  status?: EmployeeStatus;
  exitDate?: string;
  birthday?: string;
  sourceType?: string;
};

function toCreatePayload(input: NewEmployeeInput) {
  return {
    name: input.name,
    office: input.office || undefined,
    department: input.department || undefined,
    position: input.position || undefined,
    job_offer_date: input.jobOfferDate || undefined,
    start_date: input.startDate,
    status: input.status || undefined,
    exit_date: input.exitDate || undefined,
    birthday: input.birthday || undefined,
    source_type: input.sourceType || undefined,
  };
}

export async function createEmployee(input: NewEmployeeInput): Promise<Employee> {
  const row = await request<BackendEmployee>("/employees", {
    method: "POST",
    body: JSON.stringify(toCreatePayload(input)),
  });
  return fromBackend(row);
}

/** Full-record save from the Manage Employees edit form — sends every field,
 * including explicit nulls for cleared optional dates, so clearing a field in
 * the form actually clears it server-side rather than leaving the old value. */
export async function updateEmployee(employee: Employee): Promise<Employee> {
  const payload = {
    name: employee.name,
    office: employee.office,
    department: employee.department,
    position: employee.position,
    job_offer_date: employee.jobOfferDate || null,
    start_date: employee.startDate,
    status: employee.status,
    exit_date: employee.exitDate || null,
    birthday: employee.birthday || null,
    source_type: employee.sourceType || null,
  };
  const row = await request<BackendEmployee>(`/employees/${encodeURIComponent(employee.id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return fromBackend(row);
}

export async function deleteEmployee(id: string): Promise<void> {
  await request<void>(`/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type ImportRowInput = Partial<Employee>;

export async function importEmployees(
  rows: ImportRowInput[],
): Promise<{ added: number; skipped: number }> {
  const payload = rows.map((row) => ({
    id: row.id || undefined,
    name: row.name ?? "",
    office: row.office || undefined,
    department: row.department || undefined,
    position: row.position || undefined,
    job_offer_date: row.jobOfferDate || undefined,
    start_date: row.startDate || undefined,
    status: row.status || undefined,
    exit_date: row.exitDate || undefined,
    birthday: row.birthday || undefined,
    source_type: row.sourceType || undefined,
  }));
  return request<{ added: number; skipped: number }>("/employees/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
