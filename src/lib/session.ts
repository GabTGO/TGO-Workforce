// Real session, backed by the backend's signed httpOnly cookie (set by
// /auth/zoho/callback on a successful Zoho sign-in — see
// backend/app/api/routes/auth.py). There's nothing to store client-side:
// every check here just asks the backend "who is this cookie for, if
// anyone."

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiUrl } from "@/lib/api";

export type AccountRole =
  | "super_admin"
  | "admin"
  | "people_ops"
  | "hr"
  | "projects"
  | "recruitment_lead"
  | "onboarding_specialist"
  | "viewer";
export type Theme = "light" | "dark";

// Mirrors backend/app/models/permission.py's Permission enum exactly — the
// permission matrix's fixed catalog of module-level capabilities. See
// @/lib/permissions.ts for the hasPermission() helper this backs.
export type Permission =
  | "employees.view"
  | "employees.manage"
  | "onboarding.view"
  | "onboarding.manage"
  | "attendance.view"
  | "attendance.manage"
  | "attendance.approve";

export type AccountProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: AccountRole;
  is_active: boolean;
  last_login_at: string | null;
  // Every permission this account currently holds, computed server-side from
  // its role against the live matrix (see backend/app/services/permissions.py
  // and GET /auth/me) — admin/super_admin get every permission there is.
  // Nav gating, page-level access walls and canManageX() checks all read
  // this instead of hardcoding a role list, so they stay correct as soon as
  // a Super Admin edits the matrix, with no frontend redeploy needed.
  permissions: Permission[];
  // Personalization — see backend/app/schemas/account.py's
  // AccountPreferencesUpdate. Set by the signed-in person themselves (Profile
  // and Settings pages), never by an admin editing someone else's account.
  theme: Theme;
  default_office: string | null;
  notify_anniversaries: boolean;
  notify_birthdays: boolean;
  notify_new_hires: boolean;
  // Distinct from notify_new_hires above (Dashboard card visibility only) —
  // these two gate actual in-app notification-inbox events, relevant only to
  // roles that would ever receive them (see the Settings page).
  notify_on_violation_review: boolean;
  notify_on_new_hire_added: boolean;
};

export type PreferencesPatch = Partial<
  Pick<
    AccountProfile,
    | "display_name"
    | "photo_url"
    | "theme"
    | "default_office"
    | "notify_anniversaries"
    | "notify_birthdays"
    | "notify_new_hires"
    | "notify_on_violation_review"
    | "notify_on_new_hire_added"
  >
>;

// Sends the browser to the backend, which redirects to Zoho and then back to
// this app once sign-in completes. Deliberately a full navigation rather than
// a fetch — Zoho's own login page has to be a top-level page, not an iframe
// or an XHR target.
export function signInWithZoho(): void {
  window.location.href = apiUrl("/auth/zoho/login");
}

export async function fetchCurrentAccount(): Promise<AccountProfile | null> {
  try {
    const response = await fetch(apiUrl("/auth/me"), {
      credentials: "include",
    });
    if (!response.ok) return null;
    return (await response.json()) as AccountProfile | null;
  } catch {
    // Backend unreachable — treat as signed out rather than throwing, so a
    // network hiccup doesn't take down the whole app shell.
    return null;
  }
}

// Shared "who's signed in" query — used by AppShell (auth guard), the
// sidebar (admin-only nav item) and the User Management page (access gate),
// all backed by the same React Query cache so it's one network call, not
// three.
export const CURRENT_ACCOUNT_KEY = ["current-account"] as const;

export function useCurrentAccount() {
  return useQuery({
    queryKey: CURRENT_ACCOUNT_KEY,
    queryFn: fetchCurrentAccount,
    staleTime: 60_000,
  });
}

async function updateMyPreferences(
  patch: PreferencesPatch,
): Promise<AccountProfile> {
  const response = await fetch(apiUrl("/auth/me/preferences"), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Couldn't save preferences (${response.status})`);
  }
  return (await response.json()) as AccountProfile;
}

/** Backs the Profile and Settings pages' personalization controls, plus the
 * header ThemeToggle — every write here is "change my own preferences", so
 * it always targets the signed-in account, never one picked by id. */
export function useUpdateMyPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyPreferences,
    onSuccess: (account) => {
      queryClient.setQueryData(CURRENT_ACCOUNT_KEY, account);
    },
  });
}

export async function signOut(): Promise<void> {
  try {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort — the cookie expires on its own even if this call fails.
  }
}
