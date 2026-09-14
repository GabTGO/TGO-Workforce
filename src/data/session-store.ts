import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAccountPresence, terminateSession } from "@/data/session-api";

const PRESENCE_KEY = ["account-presence"] as const;

// Shorter poll than most of this app's 15s data (see employee-store.ts etc.)
// — "who's active right now" is the whole point of this panel, so it should
// feel closer to live than a directory listing needs to.
const PRESENCE_POLL_MS = 10_000;

/** `enabled` should be false for anyone who isn't Super Admin — the backend
 * 403s otherwise, and there's no reason to poll a query that will only ever
 * error for the other five roles. */
export function useAccountPresenceQuery(enabled: boolean) {
  return useQuery({
    queryKey: PRESENCE_KEY,
    queryFn: fetchAccountPresence,
    enabled,
    refetchInterval: enabled ? PRESENCE_POLL_MS : false,
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => terminateSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRESENCE_KEY }),
  });
}
