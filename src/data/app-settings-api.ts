// HTTP client for /app-settings (backend/app/api/routes/app_settings.py) —
// Super-Admin-only, runtime app-wide settings distinct from anything in the
// permission matrix. Currently just invite_only_signup.

import { apiUrl } from "@/lib/api";

export type AppSettings = {
  inviteOnlySignup: boolean;
};

type BackendAppSettings = {
  invite_only_signup: boolean;
};

function fromBackend(row: BackendAppSettings): AppSettings {
  return { inviteOnlySignup: row.invite_only_signup };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request to ${path} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  return fromBackend(await request<BackendAppSettings>("/app-settings"));
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const payload: Record<string, unknown> = {};
  if (patch.inviteOnlySignup !== undefined) payload["invite_only_signup"] = patch.inviteOnlySignup;
  return fromBackend(
    await request<BackendAppSettings>("/app-settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
}
