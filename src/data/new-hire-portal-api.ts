// HTTP client for GET /new-hires (backend/app/api/routes/new_hires_portal.py),
// a read-only proxy for the separate Onboarding/Offboarding portal's own
// external API. Kept apart from @/data/new-hire-api — that file's `NewHire`
// type is the unrelated Onboarding checklist tracker (/onboarding), and the
// two names would collide. @/data/new-hire-portal-store wraps this in a
// React Query hook; components should use that, not this file, directly.

import { apiUrl } from "@/lib/api";

export type PortalNewHireStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

// Already camelCase on the wire — the backend passes the portal's own JSON
// shape straight through, so there's no snake_case mapping step here (unlike
// employee-api.ts's fromBackend).
export interface PortalNewHire {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  startDate: string; // ISO
  status: PortalNewHireStatus;
  manager: string | null;
  createdAt: string;
  updatedAt: string;
}

/** FastAPI error responses are JSON — `{"detail": "message"}` for a plain
 * HTTPException (400/404/409/...), or `{"detail": [{"msg": "...", ...}, ...]}`
 * for a Pydantic validation error (422). Surface the human-readable message
 * either way instead of dumping raw JSON into a toast. Same helper as
 * employee-api.ts's readErrorMessage. */
async function readErrorMessage(response: Response, path: string): Promise<string> {
  const fallback = `Request to ${path} failed (${response.status})`;
  const body = await response.text();
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      const messages = parsed.detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item ? String(item.msg) : null,
        )
        .filter((msg): msg is string => Boolean(msg));
      if (messages.length > 0) return messages.join("; ");
    }
    return fallback;
  } catch {
    return body;
  }
}

export async function fetchPortalNewHires(): Promise<PortalNewHire[]> {
  const path = "/new-hires";
  const response = await fetch(apiUrl(path), { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  return (await response.json()) as PortalNewHire[];
}
