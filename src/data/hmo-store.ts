import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createHmoBillingPeriod,
  createHmoMember,
  createHmoRequest,
  fetchHmoBillingPeriods,
  fetchHmoMembers,
  fetchHmoRequests,
  updateHmoMember,
  updateHmoRequest,
  type HmoMemberInput,
  type HmoMemberPatch,
  type HmoRequestStatus,
} from "@/data/hmo-api";

// HMO Management (src/routes/hmo-management.index.tsx and
// hmo-management.$memberId.tsx) reads and writes through these hooks — same
// React Query cache + 15s poll shape as employee-store.ts/award-store.ts,
// backed by backend/app/api/routes/hmo.py.

const MEMBERS_KEY = ["hmo-members"] as const;
const REQUESTS_KEY = ["hmo-requests"] as const;
const BILLING_PERIODS_KEY = ["hmo-billing-periods"] as const;

const REALTIME_POLL_MS = 15_000;

export function useHmoMembersQuery(enabled = true) {
  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: fetchHmoMembers,
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

export function useHmoRequestsQuery(enabled = true) {
  return useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: fetchHmoRequests,
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

export function useHmoBillingPeriodsQuery(enabled = true) {
  return useQuery({
    queryKey: BILLING_PERIODS_KEY,
    queryFn: fetchHmoBillingPeriods,
    enabled,
    refetchInterval: enabled ? REALTIME_POLL_MS : false,
  });
}

export function useCreateHmoMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HmoMemberInput) => createHmoMember(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useUpdateHmoMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: HmoMemberPatch }) =>
      updateHmoMember(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useCreateHmoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      memberId: string;
      requestType: string;
      submittedDate: string;
      notes?: string;
    }) => createHmoRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export function useUpdateHmoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status?: HmoRequestStatus;
      notes?: string;
    }) => updateHmoRequest(id, { ...(status ? { status } : {}), ...(notes ? { notes } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export function useCreateHmoBillingPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { month: string; providerInvoiceAmount: number; notes?: string }) =>
      createHmoBillingPeriod(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BILLING_PERIODS_KEY }),
  });
}
