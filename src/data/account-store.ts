import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchAccounts,
  updateAccount,
  type AccountPatch,
} from "@/data/account-api";
import { CURRENT_ACCOUNT_KEY } from "@/lib/session";

const ACCOUNTS_KEY = ["accounts"] as const;

/** `enabled` should be gated to `currentAccount?.role === "admin"` by the
 * caller — the backend 403s a non-admin anyway, but there's no reason to
 * fire the request (and log the noisy error) for a role that can never see
 * this page's nav item in the first place. */
export function useAccountsQuery(enabled: boolean) {
  return useQuery({ queryKey: ACCOUNTS_KEY, queryFn: fetchAccounts, enabled });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AccountPatch }) =>
      updateAccount(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      // Covers the edge case of an admin editing their own row (blocked
      // server-side for role/active, but display_name/photo_url still go
      // through) or another admin's row affecting the signed-in menu.
      queryClient.invalidateQueries({ queryKey: CURRENT_ACCOUNT_KEY });
    },
  });
}
