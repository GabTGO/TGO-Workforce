import { useQuery } from "@tanstack/react-query";

import { fetchPortalNewHires } from "@/data/new-hire-portal-api";

// Same 15s "realtime" polling convention as @/data/employee-store — the
// portal is a separate system, so this is the only way changes there show up
// here at all (there's no push/websocket).
const REALTIME_POLL_MS = 15_000;

export function usePortalNewHires() {
  return useQuery({
    queryKey: ["portal-new-hires"],
    queryFn: fetchPortalNewHires,
    refetchInterval: REALTIME_POLL_MS,
  });
}
