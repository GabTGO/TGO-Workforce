// HTTP client for /app-settings (backend/app/api/routes/app_settings.py) —
// runtime app-wide settings distinct from anything in the permission matrix.
// GET is open to any signed-in account (the Attendance pages need to know
// whether Outlook mode is on); only PATCH is Super Admin-only, enforced
// server-side.

import { apiUrl } from "@/lib/api";

export type AppSettings = {
  inviteOnlySignup: boolean;
  // See src/lib/mailto.ts and the Send/BulkSend dialogs — when on, sending a
  // violation email opens it in the approver's own MS Outlook (mailto:)
  // instead of calling the Zoho Mail API, and marks the record Sent without
  // any delivery confirmation.
  useOutlookForViolations: boolean;
};

type BackendAppSettings = {
  invite_only_signup: boolean;
  use_outlook_for_violations: boolean;
};

function fromBackend(row: BackendAppSettings): AppSettings {
  return {
    inviteOnlySignup: row.invite_only_signup,
    useOutlookForViolations: row.use_outlook_for_violations,
  };
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
  if (patch.useOutlookForViolations !== undefined) {
    payload["use_outlook_for_violations"] = patch.useOutlookForViolations;
  }
  return fromBackend(
    await request<BackendAppSettings>("/app-settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
}
