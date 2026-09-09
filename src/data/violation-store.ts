import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveViolation,
  bulkDeleteViolations,
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
  needsCorrectionViolation,
  prepareViolation,
  previewImport,
  resendViolation,
  sendNowViolation,
  updateViolation,
  type ImportPreviewRow,
  type NewViolationInput,
  type ViolationFilters,
  type ViolationUpdateInput,
} from "@/data/violation-api";
import { ATTENDANCE_IN_PROGRESS_MESSAGE, isAttendanceDevOnlyBlocked } from "@/lib/permissions";
import { useCurrentAccount } from "@/lib/session";

// TEMPORARY: Attendance Violations is still in progress — see
// src/lib/permissions.ts's isAttendanceDevOnlyBlocked for why this exists.
// Every write hook below calls this at the top of its mutationFn; a
// synchronous throw here is caught the same way a rejected request would be,
// so every dialog's existing onError toast shows this message unchanged. To
// lift the restriction: delete this hook and its call sites below.
function useAttendanceDevGuard() {
  const { data: account } = useCurrentAccount();
  return () => {
    if (isAttendanceDevOnlyBlocked(account?.email)) {
      throw new Error(ATTENDANCE_IN_PROGRESS_MESSAGE);
    }
  };
}

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

export function useViolationsQuery(filters: ViolationFilters, page: number, pageSize: number) {
  return useQuery({
    queryKey: [...VIOLATIONS_KEY, "list", filters, page, pageSize],
    queryFn: () => fetchViolations(filters, page, pageSize),
    refetchInterval: REALTIME_POLL_MS,
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

export function useAnalyticsOverviewQuery() {
  return useQuery({
    queryKey: ANALYTICS_KEY,
    queryFn: fetchAnalyticsOverview,
    refetchInterval: REALTIME_POLL_MS,
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
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: (input: NewViolationInput) => {
      guardDev();
      return createViolation(input);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateViolation() {
  const invalidate = useInvalidateViolations();
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: ViolationUpdateInput }) => {
      guardDev();
      return updateViolation(id, changes);
    },
    onSuccess: invalidate,
  });
}

/** Every status-transition action (prepare/mark-ready/approve/hold/
 * needs-correction/resend/send-now) invalidates the same cache, so a single
 * hook covers all seven rather than seven near-identical ones. */
export function useViolationTransition() {
  const invalidate = useInvalidateViolations();
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: TransitionAction }) => {
      guardDev();
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
  | "prepare"
  | "mark-ready"
  | "approve"
  | "hold"
  | "needs-correction"
  | "resend"
  | "send-now";

export function useDeleteViolation() {
  const invalidate = useInvalidateViolations();
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: (id: number) => {
      guardDev();
      return deleteViolation(id);
    },
    onSuccess: invalidate,
  });
}

export function useBulkDeleteViolations() {
  const invalidate = useInvalidateViolations();
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: (ids: number[]) => {
      guardDev();
      return bulkDeleteViolations(ids);
    },
    onSuccess: invalidate,
  });
}

export function useBulkSendNowViolations() {
  const invalidate = useInvalidateViolations();
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: (ids: number[]) => {
      guardDev();
      return bulkSendNowViolations(ids);
    },
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
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: (file: File) => {
      guardDev();
      return previewImport(file);
    },
  });
}

export function useCommitImport() {
  const invalidate = useInvalidateViolations();
  const guardDev = useAttendanceDevGuard();
  return useMutation({
    mutationFn: ({ filename, rows }: { filename: string; rows: ImportPreviewRow[] }) => {
      guardDev();
      return commitImport(filename, rows);
    },
    onSuccess: invalidate,
  });
}
