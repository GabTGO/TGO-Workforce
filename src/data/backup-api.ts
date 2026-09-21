// HTTP client for the /backups endpoints (backend/app/api/routes/backups.py)
// — the Super Admin-only Database Backups module. Mirrors the thin-wrapper
// shape of @/data/employee-api.ts and @/data/list-options-api.ts.

import { apiUrl } from "@/lib/api";

export type BackupTrigger = "manual" | "scheduled";
export type BackupStatus = "running" | "completed" | "failed";
export type BackupFrequency = "daily" | "weekly";

export type Backup = {
  id: string;
  trigger: BackupTrigger;
  status: BackupStatus;
  // null = every table was included.
  tables: string[] | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  requestedByLabel: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type BackupSchedule = {
  enabled: boolean;
  frequency: BackupFrequency;
  // 0=Monday..6=Sunday, only meaningful when frequency is "weekly".
  dayOfWeek: number | null;
  // "HH:MM:SS", always UTC — see backend/app/models/backup_schedule.py's
  // docstring for why this doesn't convert to the viewer's local time.
  timeOfDay: string;
  tables: string[] | null;
  lastRunAt: string | null;
};

type BackendBackup = {
  id: string;
  trigger: BackupTrigger;
  status: BackupStatus;
  tables: string[] | null;
  file_name: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  requested_by_label: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

function fromBackend(row: BackendBackup): Backup {
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    tables: row.tables,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    errorMessage: row.error_message,
    requestedByLabel: row.requested_by_label,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

type BackendSchedule = {
  enabled: boolean;
  frequency: BackupFrequency;
  day_of_week: number | null;
  time_of_day: string;
  tables: string[] | null;
  last_run_at: string | null;
};

function scheduleFromBackend(row: BackendSchedule): BackupSchedule {
  return {
    enabled: row.enabled,
    frequency: row.frequency,
    dayOfWeek: row.day_of_week,
    timeOfDay: row.time_of_day,
    tables: row.tables,
    lastRunAt: row.last_run_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

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

export async function fetchBackupTables(): Promise<string[]> {
  return request<string[]>("/backups/tables");
}

export async function fetchBackups(): Promise<Backup[]> {
  const rows = await request<BackendBackup[]>("/backups");
  return rows.map(fromBackend);
}

export async function runBackup(tables: string[] | null): Promise<Backup> {
  const row = await request<BackendBackup>("/backups/run", {
    method: "POST",
    body: JSON.stringify({ tables }),
  });
  return fromBackend(row);
}

export async function deleteBackup(id: string): Promise<void> {
  await request<void>(`/backups/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchBackupSchedule(): Promise<BackupSchedule> {
  const row = await request<BackendSchedule>("/backups/schedule");
  return scheduleFromBackend(row);
}

export type BackupScheduleInput = Partial<{
  enabled: boolean;
  frequency: BackupFrequency;
  dayOfWeek: number | null;
  timeOfDay: string;
  tables: string[] | null;
}>;

export async function updateBackupSchedule(input: BackupScheduleInput): Promise<BackupSchedule> {
  const payload: Record<string, unknown> = {};
  if ("enabled" in input) payload["enabled"] = input.enabled;
  if ("frequency" in input) payload["frequency"] = input.frequency;
  if ("dayOfWeek" in input) payload["day_of_week"] = input.dayOfWeek;
  if ("timeOfDay" in input) payload["time_of_day"] = input.timeOfDay;
  if ("tables" in input) payload["tables"] = input.tables;
  const row = await request<BackendSchedule>("/backups/schedule", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return scheduleFromBackend(row);
}

/** Opened directly (window.open) rather than fetched — same pattern as
 * @/lib reportDownloadUrl for Attendance Reports. The session cookie is
 * SameSite=None in production (see backend/app/main.py), so it's carried on
 * this cross-origin navigation the same way it is on Attendance's report
 * download. */
export function backupDownloadUrl(id: string): string {
  return apiUrl(`/backups/${encodeURIComponent(id)}/download`);
}
