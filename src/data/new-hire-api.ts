// HTTP client for the /onboarding endpoints (backend/app/api/routes/new_hires.py),
// plus the mapping between the backend's snake_case row shape and this
// feature's camelCase NewHire type. Mirrors src/data/employee-api.ts's shape
// exactly. @/data/new-hire-store wraps these in React Query hooks;
// components should use that, not this file, directly.

import { apiUrl } from "@/lib/api";

export interface NewHire {
  id: string;
  name: string;
  roleTitle: string;
  // Free text, matching the source onboarding app's SOP-driven format (e.g.
  // "Sept 8, 2026 / 9:00 AM") rather than a strict calendar date.
  startDate: string;
  recruitmentLead: string;
  onboardingSpecialist: string;
  joDiscussion: boolean;
  confirmationSigned: boolean;
  welcomeEmailSent: boolean;
  // Auto-stamped server-side on the first Welcome Email Sent check — never
  // sent by the client, see NewHireInput below.
  completedBy: string | null;
  newHireInfo: boolean;
  idPhoto: boolean;
  credentialsCreated: boolean;
  onboardingDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingStatus = "Not Started" | "In Progress" | "Complete";

const CHECKLIST_KEYS = [
  "joDiscussion",
  "confirmationSigned",
  "welcomeEmailSent",
  "newHireInfo",
  "idPhoto",
  "credentialsCreated",
  "onboardingDay",
] as const satisfies readonly (keyof NewHire)[];

/** Derived, not stored — a row is "Complete" only once every checklist step
 * is checked, "Not Started" only when none are, "In Progress" otherwise. */
export function computeStatus(hire: NewHire): OnboardingStatus {
  const done = CHECKLIST_KEYS.filter((key) => hire[key] === true).length;
  if (done === 0) return "Not Started";
  if (done === CHECKLIST_KEYS.length) return "Complete";
  return "In Progress";
}

type BackendNewHire = {
  id: string;
  name: string;
  role_title: string;
  start_date: string;
  recruitment_lead: string;
  onboarding_specialist: string;
  jo_discussion: boolean;
  confirmation_signed: boolean;
  welcome_email_sent: boolean;
  completed_by: string | null;
  new_hire_info: boolean;
  id_photo: boolean;
  credentials_created: boolean;
  onboarding_day: boolean;
  created_at: string;
  updated_at: string;
};

function fromBackend(row: BackendNewHire): NewHire {
  return {
    id: row.id,
    name: row.name,
    roleTitle: row.role_title,
    startDate: row.start_date,
    recruitmentLead: row.recruitment_lead,
    onboardingSpecialist: row.onboarding_specialist,
    joDiscussion: row.jo_discussion,
    confirmationSigned: row.confirmation_signed,
    welcomeEmailSent: row.welcome_email_sent,
    completedBy: row.completed_by,
    newHireInfo: row.new_hire_info,
    idPhoto: row.id_photo,
    credentialsCreated: row.credentials_created,
    onboardingDay: row.onboarding_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include", // carries the Zoho session cookie, so writes attribute to the real signed-in account
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** FastAPI error responses are JSON — `{"detail": "message"}` for a plain
 * HTTPException (400/404/409/...), or `{"detail": [{"msg": "...", ...}, ...]}`
 * for a Pydantic validation error (422). Surface the human-readable message
 * either way instead of dumping raw JSON into a toast. Same helper as
 * employee-api.ts's readErrorMessage. */
async function readErrorMessage(
  response: Response,
  path: string,
): Promise<string> {
  const fallback = `Request to ${path} failed (${response.status})`;
  const body = await response.text();
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      const messages = parsed.detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String(item.msg)
            : null,
        )
        .filter((msg): msg is string => Boolean(msg));
      if (messages.length > 0) return messages.join("; ");
    }
    return fallback;
  } catch {
    return body;
  }
}

export async function fetchNewHires(): Promise<NewHire[]> {
  const rows = await request<BackendNewHire[]>("/onboarding");
  return rows.map(fromBackend);
}

/** Shape shared by create (all fields optional but name) and patch (every
 * field optional, only what's set is sent) — completedBy is deliberately
 * absent: it's always server-set, matching NewHireCreate/NewHireUpdate on
 * the backend, which don't accept it either. */
export type NewHireInput = {
  name: string;
  roleTitle?: string;
  startDate?: string;
  recruitmentLead?: string;
  onboardingSpecialist?: string;
  joDiscussion?: boolean;
  confirmationSigned?: boolean;
  welcomeEmailSent?: boolean;
  newHireInfo?: boolean;
  idPhoto?: boolean;
  credentialsCreated?: boolean;
  onboardingDay?: boolean;
};

export type NewHirePatch = Partial<NewHireInput>;

function toBackendPayload(input: NewHireInput | NewHirePatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload["name"] = input.name;
  if (input.roleTitle !== undefined) payload["role_title"] = input.roleTitle;
  if (input.startDate !== undefined) payload["start_date"] = input.startDate;
  if (input.recruitmentLead !== undefined) payload["recruitment_lead"] = input.recruitmentLead;
  if (input.onboardingSpecialist !== undefined)
    payload["onboarding_specialist"] = input.onboardingSpecialist;
  if (input.joDiscussion !== undefined) payload["jo_discussion"] = input.joDiscussion;
  if (input.confirmationSigned !== undefined)
    payload["confirmation_signed"] = input.confirmationSigned;
  if (input.welcomeEmailSent !== undefined) payload["welcome_email_sent"] = input.welcomeEmailSent;
  if (input.newHireInfo !== undefined) payload["new_hire_info"] = input.newHireInfo;
  if (input.idPhoto !== undefined) payload["id_photo"] = input.idPhoto;
  if (input.credentialsCreated !== undefined)
    payload["credentials_created"] = input.credentialsCreated;
  if (input.onboardingDay !== undefined) payload["onboarding_day"] = input.onboardingDay;
  return payload;
}

export async function createNewHire(input: NewHireInput): Promise<NewHire> {
  const row = await request<BackendNewHire>("/onboarding", {
    method: "POST",
    body: JSON.stringify(toBackendPayload(input)),
  });
  return fromBackend(row);
}

/** PATCH — only the fields present in `patch` are sent/changed server-side,
 * which is what makes a single checklist checkbox toggle a one-field call
 * instead of resending the whole row. */
export async function updateNewHire(
  id: string,
  patch: NewHirePatch,
): Promise<NewHire> {
  const row = await request<BackendNewHire>(`/onboarding/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(toBackendPayload(patch)),
  });
  return fromBackend(row);
}

export async function deleteNewHire(id: string): Promise<void> {
  await request<void>(`/onboarding/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Relays a "Notify" message (built by src/lib/onboarding-notify.ts) to Zoho
 * Cliq — see backend/app/api/routes/new_hires.py's POST /onboarding/notify. */
export async function sendCliqNotification(message: string): Promise<void> {
  await request<void>("/onboarding/notify", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
