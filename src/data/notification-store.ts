import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/data/notification-api";

// The nav bell icon and its dropdown read and write through these hooks — a
// React Query cache keyed on "notifications", backed by the FastAPI/Postgres
// API (see backend/app/api/routes/notifications.py). Mirrors
// @/data/employee-store's shape and polling convention.

const NOTIFICATIONS_KEY = ["notifications"] as const;
const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

// Same "multiple things can change server-side between your own actions"
// rationale as employee-store.ts — someone else's action (e.g. a violation
// getting prepared) can create a notification for you at any time.
const REALTIME_POLL_MS = 15_000;

export function useNotificationsQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => fetchNotifications(),
    refetchInterval: REALTIME_POLL_MS,
  });
}

/** Lightweight poll target for the bell's badge count — separate from the
 * full list query so the dropdown doesn't have to be open for the badge to
 * stay fresh. */
export function useUnreadCountQuery() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: fetchUnreadCount,
    refetchInterval: REALTIME_POLL_MS,
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });
}
