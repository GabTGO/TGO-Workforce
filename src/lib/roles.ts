// Shared by the User Management page (role picker) and the Profile page
// (read-only role badge) — one label map instead of two copies drifting.

import type { AccountRole } from "@/lib/session";

export const ROLE_LABELS: Record<AccountRole, string> = {
  admin: "Admin",
  people_ops: "People Ops",
  hr: "HR",
  projects: "Projects",
  recruitment_lead: "Recruitment Lead",
  onboarding_specialist: "Onboarding Specialist",
  viewer: "Viewer",
};

export const ROLE_OPTIONS: AccountRole[] = [
  "admin",
  "people_ops",
  "hr",
  "projects",
  "recruitment_lead",
  "onboarding_specialist",
  "viewer",
];
