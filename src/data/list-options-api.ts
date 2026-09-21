// HTTP client for the /list-options endpoints
// (backend/app/api/routes/list_options.py) — the shared Department/Position/
// Level suggestion lists shown in the Edit Employee and New Hire dialogs'
// combobox (see @/components/creatable-combobox-field.tsx). Mirrors
// @/data/employee-api.ts's thin-wrapper shape.

import { apiUrl } from "@/lib/api";

export type ListKey = "departments" | "positions" | "levels";

export type ListOptions = {
  departments: string[];
  positions: string[];
  levels: string[];
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

/** Same error-unwrapping as the other data modules — surfaces FastAPI's
 * `{"detail": "..."}` (or a Pydantic 422 array) as a plain string instead of
 * a raw JSON blob in a toast. */
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

export async function fetchListOptions(): Promise<ListOptions> {
  return request<ListOptions>("/list-options");
}

export async function addListOption(listKey: ListKey, value: string): Promise<ListOptions> {
  return request<ListOptions>(`/list-options/${listKey}/add`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export async function renameListOption(
  listKey: ListKey,
  oldValue: string,
  newValue: string,
): Promise<ListOptions> {
  return request<ListOptions>(`/list-options/${listKey}/rename`, {
    method: "POST",
    body: JSON.stringify({ old_value: oldValue, new_value: newValue }),
  });
}

export async function removeListOption(listKey: ListKey, value: string): Promise<ListOptions> {
  return request<ListOptions>(`/list-options/${listKey}/remove`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}
