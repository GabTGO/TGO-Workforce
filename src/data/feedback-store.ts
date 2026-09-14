import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createFeedback,
  deleteFeedback,
  fetchFeedback,
  updateFeedback,
  type Feedback,
  type FeedbackAdminPatch,
  type FeedbackInput,
} from "@/data/feedback-api";

// The Feedback Kanban board (src/routes/feedback.tsx) reads and writes
// through these hooks — a React Query cache keyed on "feedback", backed by
// the FastAPI/Postgres API (see backend/app/api/routes/feedback.py).
// Mirrors employee-store.ts's shape.

const FEEDBACK_KEY = ["feedback"] as const;

const REALTIME_POLL_MS = 15_000;

export function useFeedbackQuery() {
  return useQuery({
    queryKey: FEEDBACK_KEY,
    queryFn: fetchFeedback,
    refetchInterval: REALTIME_POLL_MS,
  });
}

export function useFeedback(): Feedback[] {
  const { data } = useFeedbackQuery();
  return data ?? [];
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeedbackInput) => createFeedback(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FeedbackAdminPatch }) => updateFeedback(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFeedback(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  });
}
