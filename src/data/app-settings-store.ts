import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAppSettings, updateAppSettings, type AppSettings } from "@/data/app-settings-api";

const APP_SETTINGS_KEY = ["app-settings"] as const;

/** GET is open to any signed-in account (see backend/app/api/routes/
 * app_settings.py) — `enabled` just guards against firing before there's a
 * reason to (e.g. account not loaded yet), not an access-control gate.
 * Editing via useUpdateAppSettings below is still Super Admin-only,
 * enforced server-side on PATCH. */
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
