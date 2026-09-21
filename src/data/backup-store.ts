import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteBackup,
  fetchBackups,
  fetchBackupSchedule,
  fetchBackupTables,
  runBackup,
  updateBackupSchedule,
  type BackupScheduleInput,
} from "@/data/backup-api";

const BACKUPS_KEY = ["backups"] as const;
const BACKUP_SCHEDULE_KEY = ["backup-schedule"] as const;
const BACKUP_TABLES_KEY = ["backup-tables"] as const;

// "Real-time" per the feature request — a scheduled backup can complete
// while this page isn't the one that triggered it (the worker runs it), and
// a manual run from another Super Admin's tab should show up here too. Same
// 15s background-refetch approach as @/data/employee-store, not a websocket.
const REALTIME_POLL_MS = 15_000;

export function useBackupsQuery() {
  return useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: fetchBackups,
    refetchInterval: REALTIME_POLL_MS,
  });
}

/** The live list of real table names to choose from when scoping a backup to
 * specific tables — doesn't change while the app is running, so no poll. */
export function useBackupTablesQuery() {
  return useQuery({
    queryKey: BACKUP_TABLES_KEY,
    queryFn: fetchBackupTables,
    staleTime: 5 * 60_000,
  });
}

export function useBackupScheduleQuery() {
  return useQuery({
    queryKey: BACKUP_SCHEDULE_KEY,
    queryFn: fetchBackupSchedule,
  });
}

export function useRunBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tables: string[] | null) => runBackup(tables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBackup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });
}

export function useUpdateBackupSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BackupScheduleInput) => updateBackupSchedule(input),
    onSuccess: (schedule) => queryClient.setQueryData(BACKUP_SCHEDULE_KEY, schedule),
  });
}
