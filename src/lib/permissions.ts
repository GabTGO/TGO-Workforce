// Single source of truth for "which roles can write employee data" on the
// frontend — mirrors EMPLOYEE_WRITE_ROLES in backend/app/core/auth.py.
// Every button that creates/edits/deletes/imports employees should gate on
// canManageEmployees() rather than re-deriving its own role list, so the two
// stay in sync. Hiding the button is a UX nicety, not the real access
// control — the backend enforces the same rule on every write endpoint
// regardless of what the UI shows, so this is safe to get slightly wrong
// without it becoming a security hole.
//
// Role matrix (agreed 2026-09-03):
//   admin       — full access, including User Management (role changes)
//   people_ops  — full employee CRUD (create/edit/delete/import/export),
//                 no User Management
//   hub_lead    — same as people_ops for now; per-office scoping (a hub
//                 lead only managing their own office's roster) would need
//                 an "assigned office" field on Account that doesn't exist
//                 yet — revisit if that's actually needed
//   viewer      — read-only: search/filter/sort/pagination/export, but no
//                 create/edit/delete/import/bulk-delete

import type { AccountRole } from "@/lib/session";

const EMPLOYEE_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "people_ops",
  "hub_lead",
]);

export function canManageEmployees(role: AccountRole | undefined): boolean {
  return !!role && EMPLOYEE_WRITE_ROLES.has(role);
}
