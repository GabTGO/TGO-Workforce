// Frontend-only prototype data for Employee Benefits > HMO Management (see
// src/routes/hmo-management.tsx) — there's no backend for this module yet
// (matches Permission.BENEFITS_VIEW/MANAGE's own "placeholder until scoped"
// comment in backend/app/models/permission.py), so this generates
// plausible-looking demo enrollment records for the REAL employees already
// in the directory, entirely in memory (nothing persists across a reload).
//
// Deliberately does NOT invent dependent names or relationships for anyone
// — these are real people, so every generated member starts with zero
// dependents; "Add Dependent" exists to demonstrate the workflow, not to
// pre-populate someone's actual family with fictional details.
import type { Employee } from "@/data/employees";

export type HmoPlan = "Basic" | "Standard" | "Premium" | "Executive";
export type HmoProvider = "Maxicare" | "Intellicare" | "Medicard" | "PhilCare";
export type HmoStatus = "Active" | "Pending" | "Inactive";
export type DependentRelationship = "Spouse" | "Child" | "Parent";
export type HmoRequestType =
  "New Enrollment" | "Add Dependent" | "Plan Upgrade" | "Cancellation" | "Card Replacement";
export type HmoRequestStatus = "Pending" | "Approved" | "Rejected";

export type HmoDependent = {
  id: string;
  name: string;
  relationship: DependentRelationship;
  birthday: string;
  status: HmoStatus;
};

export type HmoMember = {
  employeeId: string;
  plan: HmoPlan;
  provider: HmoProvider;
  policyNumber: string;
  enrollmentDate: string;
  status: HmoStatus;
  coverageAmount: number;
  dependents: HmoDependent[];
};

export type HmoRequest = {
  id: string;
  employeeId: string;
  type: HmoRequestType;
  status: HmoRequestStatus;
  submittedDate: string;
  notes: string;
};

export const HMO_PLANS: HmoPlan[] = ["Basic", "Standard", "Premium", "Executive"];
export const HMO_PROVIDERS: HmoProvider[] = ["Maxicare", "Intellicare", "Medicard", "PhilCare"];
export const HMO_COVERAGE_BY_PLAN: Record<HmoPlan, number> = {
  Basic: 100_000,
  Standard: 200_000,
  Premium: 350_000,
  Executive: 500_000,
};
export const DEPENDENT_RELATIONSHIPS: DependentRelationship[] = ["Spouse", "Child", "Parent"];
export const HMO_REQUEST_TYPES: HmoRequestType[] = [
  "New Enrollment",
  "Add Dependent",
  "Plan Upgrade",
  "Cancellation",
  "Card Replacement",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic (same employee -> same plan/provider every render, not
 * re-randomized) demo enrollment for every active employee. A plan/provider/
 * policy assignment for prototype purposes — not a real HMO record. */
export function generateHmoMembers(employees: Employee[]): HmoMember[] {
  return employees
    .filter((e) => e.status === "Active")
    .map((e) => {
      const h = hashString(e.id);
      const plan = HMO_PLANS[h % HMO_PLANS.length]!;
      const provider = HMO_PROVIDERS[Math.floor(h / 4) % HMO_PROVIDERS.length]!;
      return {
        employeeId: e.id,
        plan,
        provider,
        policyNumber: `${provider.slice(0, 3).toUpperCase()}-${String(1000 + (h % 9000))}`,
        enrollmentDate: e.startDate,
        status: "Active" as HmoStatus,
        coverageAmount: HMO_COVERAGE_BY_PLAN[plan],
        dependents: [],
      };
    });
}

/** A handful of seeded workflow requests against the first few generated
 * members, so the Requests tab isn't empty on first load — statuses and
 * request types only, no fabricated personal detail. */
export function generateHmoRequests(members: HmoMember[]): HmoRequest[] {
  const sample = members.slice(0, Math.min(4, members.length));
  const types: HmoRequestType[] = [
    "New Enrollment",
    "Plan Upgrade",
    "Card Replacement",
    "Cancellation",
  ];
  const statuses: HmoRequestStatus[] = ["Pending", "Approved", "Pending", "Rejected"];
  return sample.map((m, i) => ({
    id: `req-${m.employeeId}-${i}`,
    employeeId: m.employeeId,
    type: types[i % types.length]!,
    status: statuses[i % statuses.length]!,
    submittedDate: new Date(Date.now() - (i + 1) * 4 * 86_400_000).toISOString().slice(0, 10),
    notes: "",
  }));
}
