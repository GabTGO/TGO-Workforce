import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Employee } from "@/data/employees";
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  importEmployees,
  updateEmployee,
  type ImportRowInput,
  type NewEmployeeInput,
} from "@/data/employee-api";

// The Employee Directory, Manage Employees dialog, New Hire form and Excel
// Import all read and write through these hooks — a React Query cache keyed
// on "employees", backed by the FastAPI/Postgres API (see
// backend/app/api/routes/employees.py). A mutation invalidates that cache on
// success, so every consumer re-renders with the fresh list — same "an edit
// in one place shows up everywhere else immediately" behavior the old
// localStorage-backed store had, just backed by a real database now instead
// of per-browser storage.

const EMPLOYEES_KEY = ["employees"] as const;

export function useEmployeesQuery() {
  return useQuery({ queryKey: EMPLOYEES_KEY, queryFn: fetchEmployees });
}

/** Convenience for read-only consumers that just want the list — empty while
 * loading or on error, the same shape the old synchronous store returned.
 * Use useEmployeesQuery() directly where a loading/error state matters. */
export function useEmployees(): Employee[] {
  const { data } = useEmployeesQuery();
  return data ?? [];
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewEmployeeInput) => createEmployee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employee: Employee) => updateEmployee(employee),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useImportEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: ImportRowInput[]) => importEmployees(rows),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}
