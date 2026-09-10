// HTTP client for the /permissions/matrix endpoints (backend/app/api/routes/
// permissions.py) — Super-Admin-only. Field names already match the backend's
// JSON one-for-one (role, permissions, key, title, description are all
// single words), so unlike @/data/account-api there's no snake_case<->
// camelCase mapping layer needed here.

import { apiUrl } from "@/lib/api";
import type { AccountRole, Permission } from "@/lib/session";

export type PermissionInfo = {
  key: Permission;
  title: string;
  description: string;
};

export type RoleMatrixEntry = {
  role: AccountRole;
  permissions: Permission[];
};

export type PermissionMatrix = {
  permissions: PermissionInfo[];
  roles: RoleMatrixEntry[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  return (await response.json()) as T;
}

/** Same error-unwrapping as @/data/account-api's readErrorMessage — surfaces
 * FastAPI's `{"detail": "..."}` (or a Pydantic 422 array) as a plain string
 * instead of a raw JSON blob in a toast. */
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

export async function fetchPermissionMatrix(): Promise<PermissionMatrix> {
  return request<PermissionMatrix>("/permissions/matrix");
}

/** Sends the whole editable matrix at once (a role missing from `grants` is
 * left untouched server-side, not cleared) — see PermissionMatrixUpdate in
 * backend/app/schemas/permission.py. */
export async function updatePermissionMatrix(
  grants: Partial<Record<AccountRole, Permission[]>>,
): Promise<PermissionMatrix> {
  return request<PermissionMatrix>("/permissions/matrix", {
    method: "PUT",
    body: JSON.stringify({ grants }),
  });
}
