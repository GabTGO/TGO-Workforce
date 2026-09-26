// Frontend-only prototype data for Employee Benefits > HMO Management (see
// src/routes/hmo-management.tsx) — there's no backend for this module yet
// (matches Permission.BENEFITS_VIEW/MANAGE's own "placeholder until scoped"
// comment in backend/app/models/permission.py).
//
// Deliberately entirely fictional and disconnected from the real Employee
// Directory — every name, department assignment and status below is made
// up for demo purposes, not a real person's actual HMO enrollment. Only the
// department/office/plan LABELS are borrowed from the real app's own
// constants (@/data/employees) for flavor; no real employee record is read.
// Nothing here persists past a page reload — it's a UI prototype layer,
// not real enrollment/billing data.
import { DEPARTMENTS, OFFICES } from "@/data/employees";

export type HmoMemberStatus =
  | "Not Eligible"
  | "Waiting for Requirements"
  | "Ready for Submission"
  | "Submitted"
  | "For Processing"
  | "Activated"
  | "Suspended"
  | "Terminated"
  | "Rejected";

export type HmoCoverageType =
  "Employee Only" | "Employee + Spouse" | "Employee + Dependents" | "Family";

export type HmoPlan = "Bronze" | "Silver" | "Gold" | "Platinum";

export type HmoCardStatus = "Not Issued" | "Pending" | "Issued" | "Released";

export type DependentRelationship = "Spouse" | "Child" | "Parent";
export type DependentStatus = "Pending" | "Verified" | "Rejected";

export type HmoDependent = {
  id: string;
  memberId: string;
  name: string;
  relationship: DependentRelationship;
  birthday: string;
  status: DependentStatus;
};

export type HmoMember = {
  id: string;
  name: string;
  department: string;
  position: string;
  office: string;
  status: HmoMemberStatus;
  coverageType: HmoCoverageType;
  plan: HmoPlan;
  policyNumber: string;
  eligibilityDate: string;
  enrollmentDate: string | null;
  coverageAmount: number;
  monthlyPremium: number;
  virtualCardStatus: HmoCardStatus;
  physicalCardStatus: HmoCardStatus;
};

export type HmoRequestType =
  "New Enrollment" | "Add Dependent" | "Plan Upgrade" | "Cancellation" | "Card Replacement";
export type HmoRequestStatus = "Pending" | "Approved" | "Rejected";

export type HmoRequest = {
  id: string;
  memberId: string;
  type: HmoRequestType;
  status: HmoRequestStatus;
  submittedDate: string;
  notes: string;
};

export type HmoBillingStatus = "Paid" | "Pending" | "Disputed";

export type HmoBillingRecord = {
  id: string;
  month: string; // "2026-08"
  expectedAmount: number;
  billedAmount: number;
  status: HmoBillingStatus;
};

export const HMO_PROVIDER = "MediCare Plus";
export const HMO_PLANS: HmoPlan[] = ["Bronze", "Silver", "Gold", "Platinum"];
export const HMO_COVERAGE_TYPES: HmoCoverageType[] = [
  "Employee Only",
  "Employee + Spouse",
  "Employee + Dependents",
  "Family",
];
export const HMO_MEMBER_STATUSES: HmoMemberStatus[] = [
  "Not Eligible",
  "Waiting for Requirements",
  "Ready for Submission",
  "Submitted",
  "For Processing",
  "Activated",
  "Suspended",
  "Terminated",
  "Rejected",
];
export const DEPENDENT_RELATIONSHIPS: DependentRelationship[] = ["Spouse", "Child", "Parent"];
export const HMO_REQUEST_TYPES: HmoRequestType[] = [
  "New Enrollment",
  "Add Dependent",
  "Plan Upgrade",
  "Cancellation",
  "Card Replacement",
];

const COVERAGE_BY_PLAN: Record<HmoPlan, number> = {
  Bronze: 100_000,
  Silver: 200_000,
  Gold: 350_000,
  Platinum: 500_000,
};

const PREMIUM_BY_PLAN: Record<HmoPlan, number> = {
  Bronze: 850,
  Silver: 1_450,
  Gold: 2_100,
  Platinum: 3_200,
};

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function policyNumber(index: number): string {
  return `MCP-${String(4000 + index)}`;
}

type MemberSeed = {
  name: string;
  department: string;
  position: string;
  office: string;
  status: HmoMemberStatus;
  plan: HmoPlan;
  coverageType: HmoCoverageType;
  eligibilityInDays: number;
  enrolledDaysAgo: number | null;
  virtualCardStatus: HmoCardStatus;
  physicalCardStatus: HmoCardStatus;
  dependents?: { name: string; relationship: DependentRelationship; status: DependentStatus }[];
};

// Hand-authored so the status/coverage/card mix reads like a real book of
// business at a glance — every HmoMemberStatus and HmoCardStatus value
// appears at least once.
const MEMBER_SEEDS: MemberSeed[] = [
  {
    name: "Miguel Santos",
    department: DEPARTMENTS[0],
    position: "Dispatcher",
    office: OFFICES[0],
    status: "Activated",
    plan: "Gold",
    coverageType: "Family",
    eligibilityInDays: -180,
    enrolledDaysAgo: 150,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
    dependents: [
      { name: "Elena Santos", relationship: "Spouse", status: "Verified" },
      { name: "Mico Santos", relationship: "Child", status: "Verified" },
    ],
  },
  {
    name: "Isabel Torres",
    department: DEPARTMENTS[1],
    position: "Business Associate",
    office: OFFICES[0],
    status: "Activated",
    plan: "Silver",
    coverageType: "Employee + Spouse",
    eligibilityInDays: -200,
    enrolledDaysAgo: 170,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
    dependents: [{ name: "Marco Torres", relationship: "Spouse", status: "Verified" }],
  },
  {
    name: "Carlos Mendoza",
    department: DEPARTMENTS[2],
    position: "Recruitment Associate",
    office: OFFICES[1],
    status: "Activated",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: -220,
    enrolledDaysAgo: 190,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Pending",
  },
  {
    name: "Sofia Reyes",
    department: DEPARTMENTS[3],
    position: "Chief of Staff",
    office: OFFICES[0],
    status: "Activated",
    plan: "Platinum",
    coverageType: "Family",
    eligibilityInDays: -240,
    enrolledDaysAgo: 210,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
    dependents: [
      { name: "Rafael Reyes", relationship: "Spouse", status: "Verified" },
      { name: "Nina Reyes", relationship: "Child", status: "Pending" },
    ],
  },
  {
    name: "Andres Villanueva",
    department: DEPARTMENTS[4],
    position: "Sales Representative",
    office: OFFICES[1],
    status: "Activated",
    plan: "Silver",
    coverageType: "Employee Only",
    eligibilityInDays: -160,
    enrolledDaysAgo: 130,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
  },
  {
    name: "Camila Fernandez",
    department: DEPARTMENTS[5],
    position: "FHP - VA",
    office: OFFICES[1],
    status: "Activated",
    plan: "Gold",
    coverageType: "Employee + Dependents",
    eligibilityInDays: -190,
    enrolledDaysAgo: 160,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
    dependents: [{ name: "Tomas Fernandez", relationship: "Child", status: "Verified" }],
  },
  {
    name: "Rafael Dela Cruz",
    department: DEPARTMENTS[6],
    position: "Head of Projects & Payroll",
    office: OFFICES[0],
    status: "Activated",
    plan: "Platinum",
    coverageType: "Family",
    eligibilityInDays: -260,
    enrolledDaysAgo: 230,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
    dependents: [{ name: "Grace Dela Cruz", relationship: "Spouse", status: "Verified" }],
  },
  {
    name: "Valentina Garcia",
    department: DEPARTMENTS[7],
    position: "Payroll Associate",
    office: OFFICES[1],
    status: "Activated",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: -150,
    enrolledDaysAgo: 120,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
  },
  {
    name: "Mateo Bautista",
    department: DEPARTMENTS[0],
    position: "Dispatch Lead",
    office: OFFICES[0],
    status: "Activated",
    plan: "Silver",
    coverageType: "Employee + Spouse",
    eligibilityInDays: -170,
    enrolledDaysAgo: 140,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Pending",
    dependents: [{ name: "Lucia Bautista", relationship: "Spouse", status: "Verified" }],
  },
  {
    name: "Gabriela Morales",
    department: DEPARTMENTS[1],
    position: "Business Associate",
    office: OFFICES[0],
    status: "Activated",
    plan: "Gold",
    coverageType: "Employee Only",
    eligibilityInDays: -140,
    enrolledDaysAgo: 110,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
  },
  {
    name: "Diego Ramirez",
    department: DEPARTMENTS[2],
    position: "Talent Acquisition Lead",
    office: OFFICES[1],
    status: "Activated",
    plan: "Silver",
    coverageType: "Employee Only",
    eligibilityInDays: -130,
    enrolledDaysAgo: 100,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
  },
  {
    name: "Antonio Cruz",
    department: DEPARTMENTS[3],
    position: "Head of HR",
    office: OFFICES[0],
    status: "Activated",
    plan: "Platinum",
    coverageType: "Employee + Dependents",
    eligibilityInDays: -300,
    enrolledDaysAgo: 260,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
    dependents: [
      { name: "Leah Cruz", relationship: "Child", status: "Verified" },
      { name: "Marco Cruz", relationship: "Child", status: "Verified" },
    ],
  },
  {
    name: "Patricia Aquino",
    department: DEPARTMENTS[4],
    position: "Sales Representative",
    office: OFFICES[0],
    status: "Suspended",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: -90,
    enrolledDaysAgo: 60,
    virtualCardStatus: "Issued",
    physicalCardStatus: "Issued",
  },
  {
    name: "Ricardo Flores",
    department: DEPARTMENTS[5],
    position: "FHP - Bid Coordinator",
    office: OFFICES[1],
    status: "Terminated",
    plan: "Silver",
    coverageType: "Employee Only",
    eligibilityInDays: -400,
    enrolledDaysAgo: 370,
    virtualCardStatus: "Released",
    physicalCardStatus: "Released",
  },
  {
    name: "Bianca Navarro",
    department: DEPARTMENTS[6],
    position: "Business Associate",
    office: OFFICES[0],
    status: "Rejected",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: -20,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Emilio Castillo",
    department: DEPARTMENTS[7],
    position: "US Payroll Specialists",
    office: OFFICES[1],
    status: "For Processing",
    plan: "Gold",
    coverageType: "Employee + Spouse",
    eligibilityInDays: -10,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Renz Villaflor",
    department: DEPARTMENTS[0],
    position: "L2 - Dispatcher",
    office: OFFICES[0],
    status: "For Processing",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: -8,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Karen Del Mundo",
    department: DEPARTMENTS[1],
    position: "Business Associate",
    office: OFFICES[1],
    status: "Submitted",
    plan: "Silver",
    coverageType: "Employee Only",
    eligibilityInDays: -5,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Julius Pascual",
    department: DEPARTMENTS[2],
    position: "Recruitment Associate",
    office: OFFICES[0],
    status: "Submitted",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: -3,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Marielle Ocampo",
    department: DEPARTMENTS[3],
    position: "Business Associate",
    office: OFFICES[0],
    status: "Ready for Submission",
    plan: "Gold",
    coverageType: "Employee + Spouse",
    eligibilityInDays: 2,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Vincent Dizon",
    department: DEPARTMENTS[4],
    position: "Sales Representative",
    office: OFFICES[1],
    status: "Waiting for Requirements",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: 12,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Angelica Ferrer",
    department: DEPARTMENTS[5],
    position: "FHP - VA",
    office: OFFICES[0],
    status: "Waiting for Requirements",
    plan: "Silver",
    coverageType: "Employee Only",
    eligibilityInDays: 20,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Noel Espiritu",
    department: DEPARTMENTS[6],
    position: "Business Associate",
    office: OFFICES[1],
    status: "Not Eligible",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: 25,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
  {
    name: "Precious Lim",
    department: DEPARTMENTS[7],
    position: "Payroll Associate",
    office: OFFICES[0],
    status: "Not Eligible",
    plan: "Bronze",
    coverageType: "Employee Only",
    eligibilityInDays: 45,
    enrolledDaysAgo: null,
    virtualCardStatus: "Not Issued",
    physicalCardStatus: "Not Issued",
  },
];

export function generateHmoMembers(): HmoMember[] {
  return MEMBER_SEEDS.map((seed, i) => ({
    id: `hmo-${i}`,
    name: seed.name,
    department: seed.department,
    position: seed.position,
    office: seed.office,
    status: seed.status,
    coverageType: seed.coverageType,
    plan: seed.plan,
    policyNumber: policyNumber(i),
    eligibilityDate: daysFromNow(seed.eligibilityInDays),
    enrollmentDate: seed.enrolledDaysAgo == null ? null : daysFromNow(-seed.enrolledDaysAgo),
    coverageAmount: COVERAGE_BY_PLAN[seed.plan],
    monthlyPremium: PREMIUM_BY_PLAN[seed.plan],
    virtualCardStatus: seed.virtualCardStatus,
    physicalCardStatus: seed.physicalCardStatus,
  }));
}

export function generateHmoDependents(members: HmoMember[]): HmoDependent[] {
  return MEMBER_SEEDS.flatMap((seed, i) => {
    const member = members[i];
    if (!seed.dependents || !member) return [];
    return seed.dependents.map((d, j) => ({
      id: `${member.id}-dep-${j}`,
      memberId: member.id,
      name: d.name,
      relationship: d.relationship,
      birthday: daysFromNow(-(9_000 + j * 1_500)),
      status: d.status,
    }));
  });
}

/** A handful of seeded workflow requests against the first few members, so
 * the Requests tab isn't empty on first load. */
export function generateHmoRequests(members: HmoMember[]): HmoRequest[] {
  const picks = members.slice(0, Math.min(5, members.length));
  const types: HmoRequestType[] = [
    "Card Replacement",
    "Plan Upgrade",
    "Add Dependent",
    "New Enrollment",
    "Cancellation",
  ];
  const statuses: HmoRequestStatus[] = ["Pending", "Pending", "Approved", "Pending", "Rejected"];
  const notes = [
    "Physical card lost, requesting reissue.",
    "Requesting upgrade ahead of dependent enrollment.",
    "",
    "",
    "Employee opted out of Family coverage.",
  ];
  return picks.map((m, i) => ({
    id: `req-${m.id}`,
    memberId: m.id,
    type: types[i % types.length]!,
    status: statuses[i % statuses.length]!,
    submittedDate: daysFromNow(-(i + 1) * 3),
    notes: notes[i % notes.length]!,
  }));
}

/** Six months of seeded billing lines against the provider — a small,
 * intentional variance on the most recent month to give "Billing Variance"
 * something to show. */
export function generateHmoBilling(): HmoBillingRecord[] {
  const months = 6;
  return Array.from({ length: months }, (_, i) => {
    const monthsAgo = months - 1 - i;
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsAgo);
    const month = d.toISOString().slice(0, 7);
    const expected = 28_000 + monthsAgo * 900;
    const isLatest = i === months - 1;
    const billed = isLatest ? expected - 1_200 : expected;
    return {
      id: `bill-${month}`,
      month,
      expectedAmount: expected,
      billedAmount: billed,
      status: isLatest ? "Disputed" : i === months - 2 ? "Pending" : "Paid",
    } satisfies HmoBillingRecord;
  });
}
