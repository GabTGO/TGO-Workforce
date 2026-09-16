import { useQuery } from "@tanstack/react-query";

import { apiUrl } from "@/lib/api";

// Backed by backend/app/api/routes/activity_logs.py — this is the audit
// trail record_activity() writes to on every employee create/update/delete
// and Zoho sign-in. Fetched once (React Query refetches on window focus by
// default, which is plenty fresh for an audit log) and filtered client-side
// by the Activity Logs page, same as the old hardcoded sample data did.

export type ActivityCategory =
  "Employee" | "Access" | "Data" | "System" | "Onboarding" | "Attendance";
export type ActivitySeverity = "info" | "warning" | "critical";

export type ActivityLogEntry = {
  id: string;
  timestamp: string;
  /** Raw ISO timestamp `timestamp` was formatted from — kept alongside it for
   * anything that needs to bucket/sort by real date (e.g. an activity-over-
   * time chart) instead of re-parsing the already-localized display string. */
  occurredAt: string;
  actor: string;
  action: string;
  target: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
};

type BackendActivityLog = {
  id: number;
  account_id: string | null;
  actor_label: string;
  action: string;
  target: string | null;
  category: "employee" | "access" | "data" | "system" | "onboarding" | "attendance";
  severity: ActivitySeverity;
  details: Record<string, unknown> | null;
  created_at: string;
};

function titleCase<T extends string>(value: string): T {
  return (value.charAt(0).toUpperCase() + value.slice(1)) as T;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fromBackend(row: BackendActivityLog): ActivityLogEntry {
  return {
    id: `LOG-${row.id}`,
    timestamp: formatTimestamp(row.created_at),
    occurredAt: row.created_at,
    actor: row.actor_label,
    action: row.action,
    target: row.target ?? "—",
    category: titleCase<ActivityCategory>(row.category),
    severity: row.severity,
  };
}

async function fetchActivityLogs(opts?: {
  accountId?: string;
  limit?: number;
}): Promise<ActivityLogEntry[]> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 200) });
  if (opts?.accountId) params.set("account_id", opts.accountId);
  const response = await fetch(apiUrl(`/activity-logs?${params.toString()}`), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to load activity logs (${response.status})`);
  }
  const rows = (await response.json()) as BackendActivityLog[];
  return rows.map(fromBackend);
}

// Same near-real-time approach as employee-store.ts: a 15s background
// refetch, not a websocket push — plenty fresh for an audit trail.
const REALTIME_POLL_MS = 15_000;

export function useActivityLogs() {
  return useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => fetchActivityLogs(),
    refetchInterval: REALTIME_POLL_MS,
  });
}

/** Backs the Profile page's "My Activity" section — the signed-in account's
 * own rows only. `enabled` guards against firing before the account id is
 * known (e.g. while /auth/me is still loading). */
export function useMyActivityLogs(accountId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ["activity-logs", "mine", accountId, limit],
    queryFn: () => fetchActivityLogs(accountId ? { accountId, limit } : { limit }),
    enabled: !!accountId,
    refetchInterval: REALTIME_POLL_MS,
  });
}
