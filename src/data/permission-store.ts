import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchPermissionMatrix, updatePermissionMatrix } from "@/data/permission-api";
import { CURRENT_ACCOUNT_KEY } from "@/lib/session";
import type { AccountRole, Permission } from "@/lib/session";

const PERMISSION_MATRIX_KEY = ["permission-matrix"] as const;

/** `enabled` should be gated to the signed-in account being Super Admin at
 * the call site — the backend 403s anyone else, but there's no reason to
 * fire the request for a role that can never see this section. */
export function usePermissionMatrixQuery(enabled: boolean) {
  return useQuery({
    queryKey: PERMISSION_MATRIX_KEY,
    queryFn: fetchPermissionMatrix,
    enabled,
  });
}

export function useUpdatePermissionMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grants: Partial<Record<AccountRole, Permission[]>>) =>
      updatePermissionMatrix(grants),
    onSuccess: (matrix) => {
      queryClient.setQueryData(PERMISSION_MATRIX_KEY, matrix);
      // Whoever's signed in right now may have just had their own effective
      // permissions change (e.g. a Super Admin editing their own module's
      // grants) — refetch /auth/me so nav/page gating picks it up without a
      // manual reload.
      queryClient.invalidateQueries({ queryKey: CURRENT_ACCOUNT_KEY });
    },
  });
}
