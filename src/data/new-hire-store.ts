import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createNewHire,
  deleteNewHire,
  fetchNewHires,
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

export function useNewHiresQuery() {
  return useQuery({
    queryKey: NEW_HIRES_KEY,
    queryFn: fetchNewHires,
    refetchInterval: REALTIME_POLL_MS,
  });
}

/** Convenience for read-only consumers that just want the list — empty while
 * loading or on error. Use useNewHiresQuery() directly where a loading/error
 * state matters. */
export function useNewHires(): NewHire[] {
  const { data } = useNewHiresQuery();
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
