// Real session, backed by the backend's signed httpOnly cookie (set by
// /auth/zoho/callback on a successful Zoho sign-in — see
// backend/app/api/routes/auth.py). There's nothing to store client-side:
// every check here just asks the backend "who is this cookie for, if
// anyone."

import { useQuery } from "@tanstack/react-query";

import { apiUrl } from "@/lib/api";

export type AccountRole = "admin" | "people_ops" | "hub_lead" | "viewer";

export type AccountProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: AccountRole;
  is_active: boolean;
};

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
