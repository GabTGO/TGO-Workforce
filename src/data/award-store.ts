import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAward,
  deleteAward,
  fetchAwards,
  updateAward,
  type Award,
  type AwardInput,
  type AwardPatch,
} from "@/data/award-api";

// Recognition & Awards (src/routes/awards.tsx) reads and writes through these
// hooks — a React Query cache keyed on "awards", backed by the FastAPI/
// Postgres API (see backend/app/api/routes/awards.py). Mirrors
// employee-store.ts's shape.

const AWARDS_KEY = ["awards"] as const;

const REALTIME_POLL_MS = 15_000;

/** `enabled` defaults to true; pass false when the signed-in account lacks
 * Permission.AWARDS_VIEW (see @/lib/permissions' canViewAwards) so this
 * doesn't fire a request the backend will just 403. */
export function useAwardsQuery(enabled = true) {
  return useQuery({
    queryKey: AWARDS_KEY,
    queryFn: () => fetchAwards(),
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

/** Convenience for read-only consumers that just want the list. */
export function useAwards(enabled = true): Award[] {
  const { data } = useAwardsQuery(enabled);
  return data ?? [];
}

export function useCreateAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AwardInput) => createAward(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AWARDS_KEY }),
  });
}

export function useUpdateAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AwardPatch }) => updateAward(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AWARDS_KEY }),
  });
}

export function useDeleteAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAward(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AWARDS_KEY }),
  });
}
