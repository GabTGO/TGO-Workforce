import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAppSettings, updateAppSettings, type AppSettings } from "@/data/app-settings-api";

const APP_SETTINGS_KEY = ["app-settings"] as const;

/** `enabled` should be gated to Super Admin at the call site — the backend
 * 403s anyone else. */
export function useAppSettingsQuery(enabled: boolean) {
  return useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: fetchAppSettings,
    enabled,
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateAppSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(APP_SETTINGS_KEY, settings);
    },
  });
}
