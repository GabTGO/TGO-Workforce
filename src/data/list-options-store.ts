import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addListOption,
  fetchListOptions,
  removeListOption,
  renameListOption,
  type ListKey,
  type ListOptions,
} from "@/data/list-options-api";

// manage-employees-dialog.tsx's CreatableComboboxField reads and writes
// through these hooks — a React Query cache keyed on "list-options", backed
// by the FastAPI/Postgres API (see backend/app/api/routes/list_options.py).
// Every mutation writes the server's returned (already-updated) list
// straight into the cache instead of invalidating and refetching, since the
// response already *is* the new state.

const LIST_OPTIONS_KEY = ["list-options"] as const;

export function useListOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: LIST_OPTIONS_KEY,
    queryFn: fetchListOptions,
    enabled,
    staleTime: 30_000,
  });
}

function useSetListOptions() {
  const queryClient = useQueryClient();
  return (data: ListOptions) => queryClient.setQueryData(LIST_OPTIONS_KEY, data);
}

export function useAddListOption() {
  const setData = useSetListOptions();
  return useMutation({
    mutationFn: ({ listKey, value }: { listKey: ListKey; value: string }) =>
      addListOption(listKey, value),
    onSuccess: setData,
  });
}

export function useRenameListOption() {
  const setData = useSetListOptions();
  return useMutation({
    mutationFn: ({
      listKey,
      oldValue,
      newValue,
    }: {
      listKey: ListKey;
      oldValue: string;
      newValue: string;
    }) => renameListOption(listKey, oldValue, newValue),
    onSuccess: setData,
  });
}

export function useRemoveListOption() {
  const setData = useSetListOptions();
  return useMutation({
    mutationFn: ({ listKey, value }: { listKey: ListKey; value: string }) =>
      removeListOption(listKey, value),
    onSuccess: setData,
  });
}
