// Shared by the User Management page (role picker) and the Profile page
// (read-only role badge) — one label map instead of two copies drifting.

import type { AccountRole } from "@/lib/session";

export const ROLE_LABELS: Record<AccountRole, string> = {
  admin: "Admin",
  people_ops: "People Ops",
  hub_lead: "Hub Lead",
  recruitment: "Recruitment",
  viewer: "Viewer",
};

export const ROLE_OPTIONS: AccountRole[] = [
  "admin",
  "people_ops",
  "hub_lead",
  "recruitment",
  "viewer",
];
