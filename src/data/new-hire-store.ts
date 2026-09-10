import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createNewHire,
  deleteNewHire,
  fetchNewHires,
  sendCliqNotification,
  updateNewHire,
  type NewHire,
  type NewHireInput,
  type NewHirePatch,
} from "@/data/new-hire-api";

// The onboarding checklist tracker (src/routes/onboarding.tsx) and its
// add/edit dialog and Excel import all read and write through these hooks —
// a React Query cache keyed on "onboarding", backed by the FastAPI/Postgres
// API (see backend/app/api/routes/new_hires.py). A mutation invalidates
// that cache on success, so every consumer re-renders with the fresh list.
// Mirrors src/data/employee-store.ts exactly.

const NEW_HIRES_KEY = ["onboarding", "new-hires"] as const;

// Polling interval for "realtime" data — same rationale as employee-store.ts:
// multiple people (recruitment + admin) can be checking off the same rows at
// once, so one person's toggle should show up for everyone else without a
// manual reload.
const REALTIME_POLL_MS = 15_000;

/** `enabled` defaults to true for existing callers; pass false when the
 * signed-in account lacks Permission.ONBOARDING_VIEW (see @/lib/permissions'
 * canViewOnboarding) so this doesn't fire a request the backend will just
 * 403 — e.g. the Dashboard's cross-module snapshot, which every role loads
 * regardless of whether it can actually see the Onboarding module. */
export function useNewHiresQuery(enabled = true) {
  return useQuery({
    queryKey: NEW_HIRES_KEY,
    queryFn: fetchNewHires,
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

/** Convenience for read-only consumers that just want the list — empty while
 * loading, disabled, or on error. Use useNewHiresQuery() directly where a
 * loading/error state matters. */
export function useNewHires(enabled = true): NewHire[] {
  const { data } = useNewHiresQuery(enabled);
  return data ?? [];
}

export function useCreateNewHire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewHireInput) => createNewHire(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NEW_HIRES_KEY }),
  });
}

/** Backs both the Edit dialog (a multi-field patch) and a single checklist
 * checkbox toggle (a one-field patch) — both are just "PATCH this id with
 * whatever changed." */
export function useUpdateNewHire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NewHirePatch }) =>
      updateNewHire(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NEW_HIRES_KEY }),
  });
}

export function useDeleteNewHire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNewHire(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NEW_HIRES_KEY }),
  });
}

/** No cache to invalidate — sending a Cliq notification doesn't change any
 * new-hire row, it just relays a message (see onboarding-notify-dialog.tsx). */
export function useSendCliqNotification() {
  return useMutation({
    mutationFn: (message: string) => sendCliqNotification(message),
  });
}
