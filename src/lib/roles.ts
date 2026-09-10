// Shared by the User Management page (role picker) and the Profile page
// (read-only role badge) — one label map instead of two copies drifting.

import type { AccountRole } from "@/lib/session";

export const ROLE_LABELS: Record<AccountRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  people_ops: "People Ops",
  hr: "HR",
  projects: "Projects",
  recruitment_lead: "Recruitment Lead",
  onboarding_specialist: "Onboarding Specialist",
  viewer: "Viewer",
};

export const ROLE_OPTIONS: AccountRole[] = [
  "super_admin",
  "admin",
  "people_ops",
  "hr",
  "projects",
  "recruitment_lead",
  "onboarding_specialist",
  "viewer",
];

// Mirrors the backend's own guard (see the "Only a Super Admin can grant or
// change the Super Admin role" checks in backend/app/api/routes/accounts.py):
// only an existing Super Admin should even see "Super Admin" as a choice in a
// role picker. Everyone else gets every option except that one — hiding it is
// a UX nicety, the backend 403s regardless if it's sent anyway.
export function assignableRoleOptions(
  actingRole: AccountRole | undefined,
): AccountRole[] {
  if (actingRole === "super_admin") return ROLE_OPTIONS;
  return ROLE_OPTIONS.filter((role) => role !== "super_admin");
}
