// Module-level access ("can this role touch Employees/Onboarding/Attendance
// at all") is governed by the configurable permission matrix a Super Admin
// edits on the User Management page — see backend/app/services/permissions.py
// and PermissionMatrixEditor (@/components/permission-matrix.tsx). It is NOT
// a hardcoded role list on the frontend anymore: every check below reads the
// signed-in account's own `permissions` array (populated by GET /auth/me),
// so a matrix edit takes effect immediately without a frontend redeploy.
// Hiding a button/nav item/page here is a UX nicety, not the real access
// control — the backend enforces the same permission on every route
// regardless of what the UI shows (see app/core/auth.py's require_permission).
//
// Two things stay OUT of the matrix, fixed in code on both ends:
//   - Admin and Super Admin bypass the matrix entirely — always full access
//     everywhere except editing the matrix itself, which is Super Admin only.
//     See FULL_ACCESS_ROLES/isFullAccessRole below.
//   - The SOP-mandated *field-level* splits inside Onboarding (Recruitment
//     Lead vs Onboarding Specialist's checklist columns) and Attendance
//     (Projects prepares, only HR approves/sends) — these come from written
//     SOPs, not a configurable preference, so they stay role-based via
//     canEditOnboardingField below and the backend's ROLE_FIELD_ACCESS /
//     require_violation_approver.

import type { AccountRole, Permission } from "@/lib/session";

// Mirrors FULL_ACCESS_ROLES in backend/app/services/permissions.py.
export const FULL_ACCESS_ROLES: ReadonlySet<AccountRole> = new Set([
  "admin",
  "super_admin",
]);

export function isFullAccessRole(role: AccountRole | undefined): boolean {
  return !!role && FULL_ACCESS_ROLES.has(role);
}

export function hasPermission(
  permissions: Permission[] | undefined,
  permission: Permission,
): boolean {
  return !!permissions?.includes(permission);
}

export function canViewEmployees(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "employees.view");
}

export function canManageEmployees(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "employees.manage");
}

export function canViewOnboarding(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "onboarding.view");
}

export function canManageOnboarding(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "onboarding.manage");
}

export function canViewAttendance(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "attendance.view");
}

export function canManageAttendance(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "attendance.manage");
}

export function canApproveAttendance(permissions: Permission[] | undefined): boolean {
  return hasPermission(permissions, "attendance.approve");
}

// Mirrors ROLE_FIELD_ACCESS in backend/app/api/routes/new_hires.py — the New
// Hire Onboarding Tracker SOP's protected-range split: Recruitment Lead owns
// items 1-2, Onboarding Specialist owns items 4-7, item 3 (Welcome Email
// Sent) is shared since it depends on whichever person is available first.
// Fixed by the SOP, not matrix-configurable — see the module comment above.
// Used to disable individual checklist checkboxes per role in
// src/routes/onboarding.tsx — hiding/disabling is a UX nicety here too; the
// backend enforces the same matrix on every PATCH regardless of what the UI
// allows clicking.
const ONBOARDING_FIELD_ACCESS: Record<string, ReadonlySet<AccountRole>> = {
  joDiscussion: new Set(["admin", "super_admin", "recruitment_lead"]),
  confirmationSigned: new Set(["admin", "super_admin", "recruitment_lead"]),
  welcomeEmailSent: new Set([
    "admin",
    "super_admin",
    "recruitment_lead",
    "onboarding_specialist",
  ]),
  newHireInfo: new Set(["admin", "super_admin", "onboarding_specialist"]),
  idPhoto: new Set(["admin", "super_admin", "onboarding_specialist"]),
  credentialsCreated: new Set(["admin", "super_admin", "onboarding_specialist"]),
  onboardingDay: new Set(["admin", "super_admin", "onboarding_specialist"]),
};

export function canEditOnboardingField(
  role: AccountRole | undefined,
  field: keyof typeof ONBOARDING_FIELD_ACCESS,
): boolean {
  return !!role && (ONBOARDING_FIELD_ACCESS[field]?.has(role) ?? false);
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
