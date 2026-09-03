import { useEffect, useSyncExternalStore } from "react";

import { employees, replaceEmployees, STATUSES, type Employee } from "@/data/employees";

// A minimal shared store so the Employee Directory, Manage Employees dialog and
// Excel Import all read and write the same in-memory data — an import or an edit
// in one place shows up everywhere else immediately, without a page reload.
// Every change is also mirrored into the browser's localStorage, so a refresh
// (or reopening the tab later) restores the last-saved data instead of falling
// back to the seed list. It's still not a real database — it's per-browser,
// per-device storage — but it survives refreshes. It's a stand-in until the
// app is wired to Postgres.

const STORAGE_KEY = "tgo-workforce-employees";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return employees;
}

function loadFromStorage(): Employee[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Employee[]) : null;
  } catch {
    return null; // corrupt or inaccessible storage — fall back to seed data
  }
}

function saveToStorage(rows: Employee[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // storage full/unavailable (e.g. private browsing) — data still works in-memory
  }
}

let hydrated = false;

/** Loads any previously-saved data from this browser, once, after the first mount. */
function useHydrateFromStorage() {
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      replaceEmployees(stored);
      notify();
    }
  }, []);
}

export function useEmployees(): Employee[] {
  useHydrateFromStorage();
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function normalizeStatus(value?: string): Employee["status"] {
  const match = STATUSES.find((s) => s.toLowerCase() === value?.trim().toLowerCase());
  return match ?? "Active";
}

function nextEmployeeId(current: Employee[]): string {
  const numbers = current
    .map((e) => Number(e.id.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const max = numbers.length ? Math.max(...numbers) : 1000;
  return `TGO-${max + 1}`;
}

/** Adds new employee rows (e.g. parsed from an imported Excel file). Returns how many were added. */
export function addEmployees(rows: Partial<Employee>[]): number {
  const next = [...employees];
  let added = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue; // a row with no name isn't a usable record

    const employee: Employee = {
      id: row.id?.trim() || nextEmployeeId(next),
      name,
      office: row.office?.trim() || "PH Eastwood",
      department: row.department?.trim() || "",
      position: row.position?.trim() || "",
      startDate: row.startDate?.trim() || new Date().toISOString().slice(0, 10),
      birthday: row.birthday?.trim() || "",
      status: normalizeStatus(row.status),
      exitDate: row.exitDate?.trim() || undefined,
      jobOfferDate: row.jobOfferDate?.trim() || undefined,
      sourceType: row.sourceType?.trim() || undefined,
    };

    next.push(employee);
    added++;
  }

  if (added > 0) {
    replaceEmployees(next);
    saveToStorage(next);
    notify();
  }
  return added;
}

export function updateEmployeeInStore(updated: Employee) {
  const next = employees.map((e) => (e.id === updated.id ? updated : e));
  replaceEmployees(next);
  saveToStorage(next);
  notify();
}

export function removeEmployeeFromStore(id: string) {
  const next = employees.filter((e) => e.id !== id);
  replaceEmployees(next);
  saveToStorage(next);
  notify();
}
