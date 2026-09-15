import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveViolation,
  bulkDeleteViolations,
  bulkMarkSentViaOutlook,
  bulkPreviewViolations,
  bulkSendNowViolations,
  commitImport,
  createViolation,
  deleteViolation,
  fetchAnalyticsOverview,
  fetchEmailSenderConfig,
  fetchViolation,
  fetchViolationHistory,
  fetchViolations,
  holdViolation,
  markReadyViolation,
  markSentViaOutlook,
  needsCorrectionViolation,
  prepareViolation,
  previewImport,
  resendViolation,
  sendNowViolation,
  sendViaOutlook,
  updateViolation,
  type ImportPreviewRow,
  type NewViolationInput,
  type ViolationFilters,
  type ViolationUpdateInput,
} from "@/data/violation-api";

// The Attendance Violations table, wizard, edit/bulk dialogs and import flow
// all read and write through these hooks — a React Query cache keyed on
// "violations", backed by the FastAPI/Postgres API (see
// backend/app/api/routes/violations.py). Mirrors @/data/employee-store's
// shape and polling convention exactly.

const VIOLATIONS_KEY = ["violations"] as const;
const ANALYTICS_KEY = ["violations", "analytics-overview"] as const;

// Same "multiple people signed in at once" realtime-poll rationale as
// employee-store.ts.
const REALTIME_POLL_MS = 15_000;

/** `enabled` defaults to true for existing callers; pass false when the
 * signed-in account lacks Permission.ATTENDANCE_VIEW (see @/lib/permissions'
 * canViewAttendance) so this doesn't fire a request the backend will just
 * 403 — e.g. the Dashboard's cross-module snapshot, which every role loads
 * regardless of whether it can actually see the Attendance module. */
export function useViolationsQuery(
  filters: ViolationFilters,
  page: number,
  pageSize: number,
  enabled = true,
) {
  return useQuery({
    queryKey: [...VIOLATIONS_KEY, "list", filters, page, pageSize],
    queryFn: () => fetchViolations(filters, page, pageSize),
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

export function useViolationQuery(id: number | null) {
  return useQuery({
    queryKey: [...VIOLATIONS_KEY, "detail", id],
    queryFn: () => fetchViolation(id as number),
    enabled: id !== null,
  });
}

export function useViolationHistoryQuery(id: number | null) {
  return useQuery({
    queryKey: [...VIOLATIONS_KEY, "history", id],
    queryFn: () => fetchViolationHistory(id as number),
    enabled: id !== null,
  });
}

export function useAnalyticsOverviewQuery(enabled = true) {
  return useQuery({
    queryKey: ANALYTICS_KEY,
    queryFn: fetchAnalyticsOverview,
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

export function useEmailSenderConfigQuery(enabled = true) {
  return useQuery({
    queryKey: ["violations", "email-sender-config"],
    queryFn: fetchEmailSenderConfig,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateViolations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: VIOLATIONS_KEY });
  };
}

export function useCreateViolation() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: (input: NewViolationInput) => createViolation(input),
    onSuccess: invalidate,
  });
}

export function useUpdateViolation() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: ViolationUpdateInput }) =>
      updateViolation(id, changes),
    onSuccess: invalidate,
  });
}

/** Every status-transition action (prepare/mark-ready/approve/hold/
 * needs-correction/resend/send-now) invalidates the same cache, so a single
 * hook covers all seven rather than seven near-identical ones. */
export function useViolationTransition() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: TransitionAction }) => {
      switch (action) {
        case "prepare":
          return prepareViolation(id);
        case "mark-ready":
          return markReadyViolation(id);
        case "approve":
          return approveViolation(id);
        case "hold":
          return holdViolation(id);
        case "needs-correction":
          return needsCorrectionViolation(id);
        case "resend":
          return resendViolation(id);
        case "send-now":
          return sendNowViolation(id);
      }
    },
    onSuccess: invalidate,
  });
}

export type TransitionAction =
  "prepare" | "mark-ready" | "approve" | "hold" | "needs-correction" | "resend" | "send-now";

export function useDeleteViolation() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: (id: number) => deleteViolation(id),
    onSuccess: invalidate,
  });
}

export function useBulkDeleteViolations() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: (ids: number[]) => bulkDeleteViolations(ids),
    onSuccess: invalidate,
  });
}

export function useBulkSendNowViolations() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: (ids: number[]) => bulkSendNowViolations(ids),
    onSuccess: invalidate,
  });
}

/** Applies From/Cc overrides for the MS Outlook alternate path (see
 * backend/app/models/app_settings.py's use_outlook_for_violations) right
 * before the caller opens the mailto: link themselves (see @/lib/mailto)
 * using the ViolationRecordDetail this resolves with. Does NOT mark the
 * record Sent — see useMarkSentViaOutlook below for that separate, explicit
 * step. */
export function useSendViaOutlook() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: ({
      id,
      overrides,
    }: {
      id: number;
      overrides: { fromAddress?: string; ccAddresses?: string };
    }) => sendViaOutlook(id, overrides),
    onSuccess: invalidate,
  });
}

/** The explicit, manual "I actually sent this" confirmation for the mail-app
 * alternate path — only this (and its bulk counterpart below) ever marks a
 * record Sent via that path; opening the compose window via
 * useSendViaOutlook above never does. */
export function useMarkSentViaOutlook() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: (id: number) => markSentViaOutlook(id),
    onSuccess: invalidate,
  });
}

export function useBulkMarkSentViaOutlook() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: (ids: number[]) => bulkMarkSentViaOutlook(ids),
    onSuccess: invalidate,
  });
}

export function useBulkPreviewViolationsQuery(ids: number[], enabled: boolean) {
  return useQuery({
    queryKey: [...VIOLATIONS_KEY, "bulk-preview", ids],
    queryFn: () => bulkPreviewViolations(ids),
    enabled: enabled && ids.length > 0,
  });
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: (file: File) => previewImport(file),
  });
}

export function useCommitImport() {
  const invalidate = useInvalidateViolations();
  return useMutation({
    mutationFn: ({ filename, rows }: { filename: string; rows: ImportPreviewRow[] }) =>
      commitImport(filename, rows),
    onSuccess: invalidate,
  });
}
