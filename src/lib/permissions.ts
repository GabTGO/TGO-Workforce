// Single source of truth for "which roles can write to which module" on the
// frontend — mirrors the *_WRITE_ROLES / *_APPROVE_ROLES constants in
// backend/app/core/auth.py. Every button that creates/edits/deletes/imports
// data should gate on the matching canManageX() rather than re-deriving its
// own role list, so the two stay in sync. Hiding the button is a UX nicety,
// not the real access control — the backend enforces the same rule on every
// write endpoint regardless of what the UI shows, so this is safe to get
// slightly wrong without it becoming a security hole.
//
// Role matrix (one-role-per-module policy, agreed 2026-09-09 — each
// non-admin role owns exactly one module; only admin crosses all of them):
//   admin       — full access everywhere, including User Management
//   people_ops  — Employee Directory only (create/edit/delete/import/export)
//   hub_lead    — Attendance Violations only (write AND approve/hold/send/
//                 resend — it's the module's sole non-admin owner now, not
//                 just the write-only "projects" slice it had before)
//   recruitment — Onboarding only (create/edit/delete new-hire checklist,
//                 send Cliq notifications)
//   viewer      — read-only everywhere: search/filter/sort/pagination/export
//                 in every module, but no create/edit/delete/import in any

import type { AccountRole } from "@/lib/session";

const EMPLOYEE_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "people_ops",
]);

export function canManageEmployees(role: AccountRole | undefined): boolean {
  return !!role && EMPLOYEE_WRITE_ROLES.has(role);
}

// Mirrors ONBOARDING_WRITE_ROLES in backend/app/core/auth.py.
const ONBOARDING_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "recruitment",
]);

export function canManageOnboarding(role: AccountRole | undefined): boolean {
  return !!role && ONBOARDING_WRITE_ROLES.has(role);
}

// Mirrors ATTENDANCE_WRITE_ROLES in backend/app/core/auth.py. Covers
// create/edit/prepare/import of a violation record.
const ATTENDANCE_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "hub_lead",
]);

export function canManageAttendance(role: AccountRole | undefined): boolean {
  return !!role && ATTENDANCE_WRITE_ROLES.has(role);
}

// Mirrors ATTENDANCE_APPROVE_ROLES in backend/app/core/auth.py. Same role
// set as canManageAttendance now that Hub Lead owns the whole module solo —
// kept as its own function so approve/hold/send/resend stays independently
// gate-able if a narrower split is ever reintroduced.
const ATTENDANCE_APPROVE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "hub_lead",
]);

export function canApproveAttendance(role: AccountRole | undefined): boolean {
  return !!role && ATTENDANCE_APPROVE_ROLES.has(role);
}
