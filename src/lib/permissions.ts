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
//   admin                  — full access everywhere, including User Management
//   people_ops              — Employee Directory only (create/edit/delete/import/export)
//   hr                      — Attendance Violations only, with sole approve/hold/
//                              send/resend authority (per the TGO Attendance Policy
//                              Violation Email Automation SOP section 10) — this
//                              earlier merged with Projects into one "hub_lead"
//                              role, which was wrong (corrected 2026-09-09)
//   projects                — Attendance Violations only, and only create/edit/
//                              prepare a record — cannot approve or send its own
//                              submission, per the SOP's HR-approval gate. See
//                              canApproveAttendance below for the narrower check.
//   recruitment_lead        — Onboarding only, and only checklist items 1-2
//                              (JO Discussion, Confirmation Sheet Signed) plus
//                              item 3 (Welcome Email Sent, shared) — per the New
//                              Hire Onboarding Tracker SOP. See
//                              canEditOnboardingField below for the field split;
//                              this earlier merged the two onboarding roles into
//                              one, which was wrong (corrected 2026-09-09).
//   onboarding_specialist   — Onboarding only, checklist items 4-7 plus the
//                              shared item 3 — see canEditOnboardingField.
//   viewer                   — read-only everywhere: search/filter/sort/pagination/
//                              export in every module, but no create/edit/delete/
//                              import in any

import type { AccountRole } from "@/lib/session";

const EMPLOYEE_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "people_ops",
]);

export function canManageEmployees(role: AccountRole | undefined): boolean {
  return !!role && EMPLOYEE_WRITE_ROLES.has(role);
}

// Mirrors ONBOARDING_WRITE_ROLES in backend/app/core/auth.py — the broad
// "may touch the onboarding module at all" check (create/delete a row,
// import/export, send a Cliq notification). Which *checklist fields* a role
// may edit is a separate, narrower question — see canEditOnboardingField.
const ONBOARDING_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "recruitment_lead",
  "onboarding_specialist",
]);

export function canManageOnboarding(role: AccountRole | undefined): boolean {
  return !!role && ONBOARDING_WRITE_ROLES.has(role);
}

// Mirrors ROLE_FIELD_ACCESS in backend/app/api/routes/new_hires.py — the New
// Hire Onboarding Tracker SOP's protected-range split: Recruitment Lead owns
// items 1-2, Onboarding Specialist owns items 4-7, item 3 (Welcome Email
// Sent) is shared since it depends on whichever person is available first.
// Used to disable individual checklist checkboxes per role in
// src/routes/onboarding.tsx — hiding/disabling is a UX nicety here too; the
// backend enforces the same matrix on every PATCH regardless of what the UI
// allows clicking.
const ONBOARDING_FIELD_ACCESS: Record<string, ReadonlySet<AccountRole>> = {
  joDiscussion: new Set(["admin", "recruitment_lead"]),
  confirmationSigned: new Set(["admin", "recruitment_lead"]),
  welcomeEmailSent: new Set(["admin", "recruitment_lead", "onboarding_specialist"]),
  newHireInfo: new Set(["admin", "onboarding_specialist"]),
  idPhoto: new Set(["admin", "onboarding_specialist"]),
  credentialsCreated: new Set(["admin", "onboarding_specialist"]),
  onboardingDay: new Set(["admin", "onboarding_specialist"]),
};

export function canEditOnboardingField(
  role: AccountRole | undefined,
  field: keyof typeof ONBOARDING_FIELD_ACCESS,
): boolean {
  return !!role && (ONBOARDING_FIELD_ACCESS[field]?.has(role) ?? false);
}

// Mirrors ATTENDANCE_WRITE_ROLES in backend/app/core/auth.py. Covers
// create/edit/prepare/import of a violation record — both HR and Projects
// can reach this far; only HR can actually approve/send (see
// canApproveAttendance below).
const ATTENDANCE_WRITE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "hr",
  "projects",
]);

export function canManageAttendance(role: AccountRole | undefined): boolean {
  return !!role && ATTENDANCE_WRITE_ROLES.has(role);
}

// Mirrors ATTENDANCE_APPROVE_ROLES in backend/app/core/auth.py. Narrower
// than canManageAttendance — per the SOP (section 10), only HR may approve/
// hold/needs-correction/resend/send; Projects can prepare a record but never
// approve its own submission.
const ATTENDANCE_APPROVE_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "hr",
]);

export function canApproveAttendance(role: AccountRole | undefined): boolean {
  return !!role && ATTENDANCE_APPROVE_ROLES.has(role);
}

// --- TEMPORARY: Attendance Violations is still in progress -----------------
// Mirrors backend/app/core/auth.py's _require_attendance_in_progress_dev —
// that's the enforced version of this same check (every write/approve/
// delete endpoint 403s for anyone but this email, regardless of role); this
// copy is just the UI-side hint so the buttons everyone still sees (per
// canManageAttendance/canApproveAttendance above) can show a clear message
// on click instead of a raw network-error toast. To lift the restriction
// once the module is ready for general HR/Projects use: delete this
// constant, isAttendanceDevOnlyBlocked, and its call sites in
// src/data/violation-store.ts.
export const ATTENDANCE_DEV_ONLY_EMAIL = "gabriel.battung@tgocorp.com";

export const ATTENDANCE_IN_PROGRESS_MESSAGE =
  "Attendance Violations is still in progress — only the developer account is authorized to do that right now.";

export function isAttendanceDevOnlyBlocked(email: string | undefined): boolean {
  return (email ?? "").toLowerCase() !== ATTENDANCE_DEV_ONLY_EMAIL.toLowerCase();
}
