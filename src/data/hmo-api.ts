// HTTP client for the /hmo endpoints (backend/app/api/routes/hmo.py) —
// replaces the earlier frontend-only prototype (the old @/data/hmo-mock)
// with the real, database-backed HMO Management module described in the
// SOP (TGO_HMO_Management_Portal_Update_Requirements.docx). Mirrors
// employee-api.ts's shape (fromBackend snake_case->camelCase mapping,
// request()/readErrorMessage()). @/data/hmo-store wraps these in React
// Query hooks; components should use that, not this file, directly.

import { apiUrl } from "@/lib/api";

export type HmoMemberType = "Principal" | "Dependent";
export type HmoEmploymentStatus = "Active" | "Resigned" | "Terminated" | "Withdrawn";
export type HmoManagerEvaluation =
  "Not Yet Required" | "Pending" | "Approved" | "Extended" | "On Hold" | "Not Approved";
export type HmoRelationship = "Spouse" | "Child" | "Parent" | "Other";
export type HmoMemberStatus = "Not Yet Active" | "Active" | "Inactive" | "Suspended" | "Terminated";
export type HmoBillingStatus =
  | "Not Yet Billed"
  | "Included in Billing"
  | "Adjustment Required"
  | "For Removal"
  | "Removed from Billing";
export type HmoEnrollmentStatus =
  | "Not Eligible"
  | "For Manager Evaluation"
  | "Waiting for Requirements"
  | "Ready for Endorsement"
  | "Endorsed to ETIQA"
  | "For Processing"
  | "Activated"
  | "On Hold"
  | "Rejected"
  | "Cancelled";
export type HmoVirtualCardStatus = "Not Available" | "Available" | "Sent to Employee";
export type HmoPhysicalCardStatus =
  | "Not Requested"
  | "For Processing"
  | "Ready for Release"
  | "Received by HR"
  | "Released to Employee"
  | "Returned"
  | "Lost"
  | "Replacement Requested";
export type HmoRemovalStatus =
  "Not Required" | "Pending Endorsement" | "Endorsed" | "For Processing" | "Removed";
export type HmoInactiveReason =
  | "Resigned"
  | "Terminated"
  | "End of Contract"
  | "Failed Eligibility"
  | "Employee Request"
  | "Other";
export type HmoRequestStatus = "Pending" | "Approved" | "Rejected";

export const HMO_MEMBER_TYPES: HmoMemberType[] = ["Principal", "Dependent"];
export const HMO_EMPLOYMENT_STATUSES: HmoEmploymentStatus[] = [
  "Active",
  "Resigned",
  "Terminated",
  "Withdrawn",
];
export const HMO_MANAGER_EVALUATIONS: HmoManagerEvaluation[] = [
  "Not Yet Required",
  "Pending",
  "Approved",
  "Extended",
  "On Hold",
  "Not Approved",
];
export const HMO_RELATIONSHIPS: HmoRelationship[] = ["Spouse", "Child", "Parent", "Other"];
export const HMO_MEMBER_STATUSES: HmoMemberStatus[] = [
  "Not Yet Active",
  "Active",
  "Inactive",
  "Suspended",
  "Terminated",
];
export const HMO_BILLING_STATUSES: HmoBillingStatus[] = [
  "Not Yet Billed",
  "Included in Billing",
  "Adjustment Required",
  "For Removal",
  "Removed from Billing",
];
export const HMO_ENROLLMENT_STATUSES: HmoEnrollmentStatus[] = [
  "Not Eligible",
  "For Manager Evaluation",
  "Waiting for Requirements",
  "Ready for Endorsement",
  "Endorsed to ETIQA",
  "For Processing",
  "Activated",
  "On Hold",
  "Rejected",
  "Cancelled",
];
export const HMO_VIRTUAL_CARD_STATUSES: HmoVirtualCardStatus[] = [
  "Not Available",
  "Available",
  "Sent to Employee",
];
export const HMO_PHYSICAL_CARD_STATUSES: HmoPhysicalCardStatus[] = [
  "Not Requested",
  "For Processing",
  "Ready for Release",
  "Received by HR",
  "Released to Employee",
  "Returned",
  "Lost",
  "Replacement Requested",
];
export const HMO_REMOVAL_STATUSES: HmoRemovalStatus[] = [
  "Not Required",
  "Pending Endorsement",
  "Endorsed",
  "For Processing",
  "Removed",
];
export const HMO_INACTIVE_REASONS: HmoInactiveReason[] = [
  "Resigned",
  "Terminated",
  "End of Contract",
  "Failed Eligibility",
  "Employee Request",
  "Other",
];
// Suggested-only, not DB-enforced (a renegotiated coverage tier shouldn't
// need a migration — see backend/app/models/hmo.py's module docstring).
export const HMO_RANK_OPTIONS = ["Rank 1", "Rank 2", "Rank 3", "Rank 4"];
export const HMO_ROOM_AND_BOARD_OPTIONS = ["SEMIPVT", "SMLPVT", "REGPVT"];
export const HMO_MBL_OPTIONS = ["PHP 80,000", "PHP 100,000"];
export const HMO_INCLUSION_OPTIONS = ["Included", "Not Included", "N/A"];

export interface HmoMember {
  id: string;
  memberType: HmoMemberType;

  employeeId: string | null;
  employeeName: string | null;
  department: string | null;
  employmentStatus: HmoEmploymentStatus | null;
  hireDate: string | null;
  eligibilityDate: string | null;
  managerEvaluation: HmoManagerEvaluation | null;

  principalMemberId: string | null;
  relationshipToPrincipal: HmoRelationship | null;
  dependentName: string | null;
  birthday: string | null;

  hmoCardNumber: string | null;
  memberStatus: HmoMemberStatus;
  rank: string | null;
  roomAndBoard: string | null;
  mbl: string | null;
  dental: string | null;
  ape: string | null;

  monthlyPremium: number | null;
  biweeklyDeduction: number | null;
  billingStatus: HmoBillingStatus;
  lastBillingMonth: string | null;
  billingRemarks: string | null;

  enrollmentStatus: HmoEnrollmentStatus;
  dateEndorsedToEtiqa: string | null;
  hmoEffectivityDate: string | null;
  requirementsComplete: boolean;
  enrollmentRemarks: string | null;

  virtualCardStatus: HmoVirtualCardStatus;
  virtualCardAvailableDate: string | null;
  physicalCardStatus: HmoPhysicalCardStatus;
  physicalCardReceivedByHrDate: string | null;
  physicalCardReleasedDate: string | null;
  physicalCardReturnedDate: string | null;

  removalRequired: boolean;
  removalStatus: HmoRemovalStatus;
  removalEndorsedDate: string | null;
  inactiveDate: string | null;
  inactiveReason: HmoInactiveReason | null;
  removalRemarks: string | null;

  displayName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

type BackendHmoMember = {
  id: string;
  member_type: HmoMemberType;
  employee_id: string | null;
  employee_name: string | null;
  department: string | null;
  employment_status: HmoEmploymentStatus | null;
  hire_date: string | null;
  eligibility_date: string | null;
  manager_evaluation: HmoManagerEvaluation | null;
  principal_member_id: string | null;
  relationship_to_principal: HmoRelationship | null;
  dependent_name: string | null;
  birthday: string | null;
  hmo_card_number: string | null;
  member_status: HmoMemberStatus;
  rank: string | null;
  room_and_board: string | null;
  mbl: string | null;
  dental: string | null;
  ape: string | null;
  monthly_premium: string | null;
  biweekly_deduction: string | null;
  billing_status: HmoBillingStatus;
  last_billing_month: string | null;
  billing_remarks: string | null;
  enrollment_status: HmoEnrollmentStatus;
  date_endorsed_to_etiqa: string | null;
  hmo_effectivity_date: string | null;
  requirements_complete: boolean;
  enrollment_remarks: string | null;
  virtual_card_status: HmoVirtualCardStatus;
  virtual_card_available_date: string | null;
  physical_card_status: HmoPhysicalCardStatus;
  physical_card_received_by_hr_date: string | null;
  physical_card_released_date: string | null;
  physical_card_returned_date: string | null;
  removal_required: boolean;
  removal_status: HmoRemovalStatus;
  removal_endorsed_date: string | null;
  inactive_date: string | null;
  inactive_reason: HmoInactiveReason | null;
  removal_remarks: string | null;
  display_name: string;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function fromBackendMember(row: BackendHmoMember): HmoMember {
  return {
    id: row.id,
    memberType: row.member_type,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    employmentStatus: row.employment_status,
    hireDate: row.hire_date,
    eligibilityDate: row.eligibility_date,
    managerEvaluation: row.manager_evaluation,
    principalMemberId: row.principal_member_id,
    relationshipToPrincipal: row.relationship_to_principal,
    dependentName: row.dependent_name,
    birthday: row.birthday,
    hmoCardNumber: row.hmo_card_number,
    memberStatus: row.member_status,
    rank: row.rank,
    roomAndBoard: row.room_and_board,
    mbl: row.mbl,
    dental: row.dental,
    ape: row.ape,
    monthlyPremium: toNumber(row.monthly_premium),
    biweeklyDeduction: toNumber(row.biweekly_deduction),
    billingStatus: row.billing_status,
    lastBillingMonth: row.last_billing_month,
    billingRemarks: row.billing_remarks,
    enrollmentStatus: row.enrollment_status,
    dateEndorsedToEtiqa: row.date_endorsed_to_etiqa,
    hmoEffectivityDate: row.hmo_effectivity_date,
    requirementsComplete: row.requirements_complete,
    enrollmentRemarks: row.enrollment_remarks,
    virtualCardStatus: row.virtual_card_status,
    virtualCardAvailableDate: row.virtual_card_available_date,
    physicalCardStatus: row.physical_card_status,
    physicalCardReceivedByHrDate: row.physical_card_received_by_hr_date,
    physicalCardReleasedDate: row.physical_card_released_date,
    physicalCardReturnedDate: row.physical_card_returned_date,
    removalRequired: row.removal_required,
    removalStatus: row.removal_status,
    removalEndorsedDate: row.removal_endorsed_date,
    inactiveDate: row.inactive_date,
    inactiveReason: row.inactive_reason,
    removalRemarks: row.removal_remarks,
    displayName: row.display_name,
    updatedByName: row.updated_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface HmoRequest {
  id: string;
  memberId: string;
  requestType: string;
  status: HmoRequestStatus;
  submittedDate: string;
  notes: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

type BackendHmoRequest = {
  id: string;
  member_id: string;
  request_type: string;
  status: HmoRequestStatus;
  submitted_date: string;
  notes: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

function fromBackendRequest(row: BackendHmoRequest): HmoRequest {
  return {
    id: row.id,
    memberId: row.member_id,
    requestType: row.request_type,
    status: row.status,
    submittedDate: row.submitted_date,
    notes: row.notes,
    resolvedByName: row.resolved_by_name,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

export interface HmoBillingPeriod {
  id: string;
  month: string;
  providerInvoiceAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type BackendHmoBillingPeriod = {
  id: string;
  month: string;
  provider_invoice_amount: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function fromBackendBillingPeriod(row: BackendHmoBillingPeriod): HmoBillingPeriod {
  return {
    id: row.id,
    month: row.month,
    providerInvoiceAmount: Number(row.provider_invoice_amount),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Same error-unwrapping as the other data modules. */
async function readErrorMessage(response: Response, path: string): Promise<string> {
  const fallback = `Request to ${path} failed (${response.status})`;
  const body = await response.text();
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      const messages = parsed.detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item ? String(item.msg) : null,
        )
        .filter((msg): msg is string => Boolean(msg));
      if (messages.length > 0) return messages.join("; ");
    }
    return fallback;
  } catch {
    return body;
  }
}

// --- Members ---------------------------------------------------------------

export async function fetchHmoMembers(): Promise<HmoMember[]> {
  const rows = await request<BackendHmoMember[]>("/hmo/members");
  return rows.map(fromBackendMember);
}

/** Only the fields the Add HMO Member form actually collects up front —
 * every other field (enrollment/card/removal tracking) starts at its
 * schema default and gets filled in later via updateHmoMember. */
export type HmoMemberInput = {
  memberType: HmoMemberType;
  employeeId?: string;
  principalMemberId?: string;
  relationshipToPrincipal?: HmoRelationship;
  dependentName?: string;
  birthday?: string;
  hireDate?: string;
  eligibilityDate?: string;
  hmoCardNumber?: string;
  rank?: string;
  roomAndBoard?: string;
  mbl?: string;
  dental?: string;
  ape?: string;
  monthlyPremium?: number;
  biweeklyDeduction?: number;
  /** Both default server-side (Not Eligible / Not Yet Active) when omitted —
   * the Add HMO Member form sets them explicitly so a member can be booked
   * in at whatever stage they're actually at. Kept as two separate fields
   * per the SOP's rule that enrollment stage and membership usability never
   * collapse into one status. */
  enrollmentStatus?: HmoEnrollmentStatus;
  memberStatus?: HmoMemberStatus;
};

export type HmoMemberPatch = Partial<
  Omit<HmoMemberInput, "memberType" | "employeeId" | "principalMemberId"> & {
    employmentStatus: HmoEmploymentStatus;
    managerEvaluation: HmoManagerEvaluation;
    memberStatus: HmoMemberStatus;
    billingStatus: HmoBillingStatus;
    lastBillingMonth: string;
    billingRemarks: string;
    enrollmentStatus: HmoEnrollmentStatus;
    dateEndorsedToEtiqa: string;
    hmoEffectivityDate: string;
    requirementsComplete: boolean;
    enrollmentRemarks: string;
    virtualCardStatus: HmoVirtualCardStatus;
    virtualCardAvailableDate: string;
    physicalCardStatus: HmoPhysicalCardStatus;
    physicalCardReceivedByHrDate: string;
    physicalCardReleasedDate: string;
    physicalCardReturnedDate: string;
    removalRequired: boolean;
    removalStatus: HmoRemovalStatus;
    removalEndorsedDate: string;
    inactiveDate: string;
    inactiveReason: HmoInactiveReason;
    removalRemarks: string;
  }
>;

const FIELD_MAP: Record<string, string> = {
  employeeId: "employee_id",
  principalMemberId: "principal_member_id",
  relationshipToPrincipal: "relationship_to_principal",
  dependentName: "dependent_name",
  hireDate: "hire_date",
  eligibilityDate: "eligibility_date",
  hmoCardNumber: "hmo_card_number",
  roomAndBoard: "room_and_board",
  monthlyPremium: "monthly_premium",
  biweeklyDeduction: "biweekly_deduction",
  employmentStatus: "employment_status",
  managerEvaluation: "manager_evaluation",
  memberStatus: "member_status",
  billingStatus: "billing_status",
  lastBillingMonth: "last_billing_month",
  billingRemarks: "billing_remarks",
  enrollmentStatus: "enrollment_status",
  dateEndorsedToEtiqa: "date_endorsed_to_etiqa",
  hmoEffectivityDate: "hmo_effectivity_date",
  requirementsComplete: "requirements_complete",
  enrollmentRemarks: "enrollment_remarks",
  virtualCardStatus: "virtual_card_status",
  virtualCardAvailableDate: "virtual_card_available_date",
  physicalCardStatus: "physical_card_status",
  physicalCardReceivedByHrDate: "physical_card_received_by_hr_date",
  physicalCardReleasedDate: "physical_card_released_date",
  physicalCardReturnedDate: "physical_card_returned_date",
  removalRequired: "removal_required",
  removalStatus: "removal_status",
  removalEndorsedDate: "removal_endorsed_date",
  inactiveDate: "inactive_date",
  inactiveReason: "inactive_reason",
  removalRemarks: "removal_remarks",
};

function toBackendPayload(input: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    payload[FIELD_MAP[key] ?? key] = value;
  }
  return payload;
}

export async function createHmoMember(input: HmoMemberInput): Promise<HmoMember> {
  const row = await request<BackendHmoMember>("/hmo/members", {
    method: "POST",
    body: JSON.stringify(toBackendPayload({ member_type: input.memberType, ...input })),
  });
  return fromBackendMember(row);
}

export async function updateHmoMember(id: string, patch: HmoMemberPatch): Promise<HmoMember> {
  const row = await request<BackendHmoMember>(`/hmo/members/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(toBackendPayload(patch)),
  });
  return fromBackendMember(row);
}

/** Hard delete — deleting a Principal cascades to its Dependent rows and
 * HMO requests server-side; the confirmation dialog that calls this warns
 * about that first. */
export async function deleteHmoMember(id: string): Promise<void> {
  await request<void>(`/hmo/members/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- Requests ----------------------------------------------------------------

export async function fetchHmoRequests(): Promise<HmoRequest[]> {
  const rows = await request<BackendHmoRequest[]>("/hmo/requests");
  return rows.map(fromBackendRequest);
}

export async function createHmoRequest(input: {
  memberId: string;
  requestType: string;
  submittedDate: string;
  notes?: string;
}): Promise<HmoRequest> {
  const row = await request<BackendHmoRequest>("/hmo/requests", {
    method: "POST",
    body: JSON.stringify({
      member_id: input.memberId,
      request_type: input.requestType,
      submitted_date: input.submittedDate,
      notes: input.notes ?? null,
    }),
  });
  return fromBackendRequest(row);
}

export async function updateHmoRequest(
  id: string,
  patch: { status?: HmoRequestStatus; notes?: string },
): Promise<HmoRequest> {
  const row = await request<BackendHmoRequest>(`/hmo/requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return fromBackendRequest(row);
}

// --- Billing periods -----------------------------------------------------------

export async function fetchHmoBillingPeriods(): Promise<HmoBillingPeriod[]> {
  const rows = await request<BackendHmoBillingPeriod[]>("/hmo/billing-periods");
  return rows.map(fromBackendBillingPeriod);
}

export async function createHmoBillingPeriod(input: {
  month: string;
  providerInvoiceAmount: number;
  notes?: string;
}): Promise<HmoBillingPeriod> {
  const row = await request<BackendHmoBillingPeriod>("/hmo/billing-periods", {
    method: "POST",
    body: JSON.stringify({
      month: input.month,
      provider_invoice_amount: input.providerInvoiceAmount,
      notes: input.notes ?? null,
    }),
  });
  return fromBackendBillingPeriod(row);
}
