// HTTP client for the /violations, /violation-reports, /violation-analytics
// endpoints (backend/app/api/routes/violations.py,
// backend/app/api/routes/violation_reports.py,
// backend/app/api/routes/violation_analytics.py,
// backend/app/api/routes/violation_import_export.py) — the attendance
// violation tracking + email automation domain, ported from the standalone
// "TGO Attendance Violation Email Automation" app.
//
// Mirrors @/data/employee-api.ts exactly: a thin fetch wrapper plus the
// mapping between the backend's snake_case row shape and this file's
// camelCase types. @/data/violation-store wraps these in React Query hooks;
// components should use that, not this file, directly.

import { apiUrl } from "@/lib/api";

export type Office = "PH" | "CO";
export type ViolationType = "Late Arrival" | "Call Out" | "Early Out" | "NCNS" | "Other";
export type EmailStatus =
  | "Draft"
  | "Ready to Prepare"
  | "Email Prepared"
  | "Approved"
  | "Hold"
  | "Needs Correction"
  | "Sent"
  | "Failed"
  | "Resend Approved";

export const OFFICES: Office[] = ["PH", "CO"];
export const VIOLATION_TYPES: ViolationType[] = [
  "Late Arrival",
  "Call Out",
  "Early Out",
  "NCNS",
  "Other",
];
export const EMAIL_STATUSES: EmailStatus[] = [
  "Draft",
  "Ready to Prepare",
  "Email Prepared",
  "Approved",
  "Hold",
  "Needs Correction",
  "Sent",
  "Failed",
  "Resend Approved",
];

export type ViolationRecord = {
  id: number;
  violationRecordId: string;
  office: Office;
  employeeName: string;
  employeeEmail: string;
  violationType: ViolationType;
  violationTypeOther: string | null;
  violationTypeLabel: string;
  violationDate: string;
  reason: string | null;
  emailStatus: EmailStatus;
  preparedAt: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  sentTo: string | null;
  zohoMessageId: string | null;
  automationResult: string | null;
  automationError: string | null;
  resendOf: number | null;
  resentAt: string | null;
  ccAddresses: string | null;
  fromAddress: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PreviousViolationEntry = {
  violationDate: string;
  violationType: ViolationType;
  violationTypeOther: string | null;
};

export type ViolationRecordDetail = ViolationRecord & {
  previousViolations: PreviousViolationEntry[];
  // True when previousViolations above came from this record's own manual
  // override (see edit-violation-dialog.tsx) rather than being auto-detected
  // from the employee's other Sent records this month.
  previousViolationsIsOverride: boolean;
  subjectPreview: string | null;
  bodyPreview: string | null;
  fromPreview: string | null;
  ccPreview: string | null;
};

type BackendViolationRecord = {
  id: number;
  violation_record_id: string;
  office: Office;
  employee_name: string;
  employee_email: string;
  violation_type: ViolationType;
  violation_type_other: string | null;
  violation_type_label: string | null;
  violation_date: string;
  reason: string | null;
  email_status: EmailStatus;
  prepared_at: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  sent_at: string | null;
  sent_to: string | null;
  zoho_message_id: string | null;
  automation_result: string | null;
  automation_error: string | null;
  resend_of: number | null;
  resent_at: string | null;
  cc_addresses: string | null;
  from_address: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type BackendViolationRecordDetail = BackendViolationRecord & {
  previous_violations: {
    violation_date: string;
    violation_type: ViolationType;
    violation_type_other: string | null;
  }[];
  previous_violations_is_override: boolean;
  subject_preview: string | null;
  body_preview: string | null;
  from_preview: string | null;
  cc_preview: string | null;
};

function fromBackend(row: BackendViolationRecord): ViolationRecord {
  return {
    id: row.id,
    violationRecordId: row.violation_record_id,
    office: row.office,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    violationType: row.violation_type,
    violationTypeOther: row.violation_type_other,
    violationTypeLabel: row.violation_type_label ?? row.violation_type,
    violationDate: row.violation_date,
    reason: row.reason,
    emailStatus: row.email_status,
    preparedAt: row.prepared_at,
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    sentTo: row.sent_to,
    zohoMessageId: row.zoho_message_id,
    automationResult: row.automation_result,
    automationError: row.automation_error,
    resendOf: row.resend_of,
    resentAt: row.resent_at,
    ccAddresses: row.cc_addresses,
    fromAddress: row.from_address,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function detailFromBackend(row: BackendViolationRecordDetail): ViolationRecordDetail {
  return {
    ...fromBackend(row),
    previousViolations: row.previous_violations.map((p) => ({
      violationDate: p.violation_date,
      violationType: p.violation_type,
      violationTypeOther: p.violation_type_other,
    })),
    previousViolationsIsOverride: row.previous_violations_is_override,
    subjectPreview: row.subject_preview,
    bodyPreview: row.body_preview,
    fromPreview: row.from_preview,
    ccPreview: row.cc_preview,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...(isFormData ? {} : { headers: { "Content-Type": "application/json" } }),
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** FastAPI error responses are JSON — `{"detail": "message"}` for a plain
 * HTTPException, `{"detail": {"validation_errors": [...]}}` for the
 * prepare-validation 400s, or a Pydantic validation-error array for a 422. */
async function readErrorMessage(response: Response, path: string): Promise<string> {
  const fallback = `Request to ${path} failed (${response.status})`;
  const body = await response.text();
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === "string") return detail;
    if (
      detail &&
      typeof detail === "object" &&
      "validation_errors" in detail &&
      Array.isArray((detail as { validation_errors: unknown }).validation_errors)
    ) {
      return (detail as { validation_errors: string[] }).validation_errors.join(", ");
    }
    if (Array.isArray(detail)) {
      const messages = detail
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

export type ViolationFilters = {
  // Explicitly `| undefined` (not just `?:`) so callers that build this
  // object with a ternary — `office: x === "all" ? undefined : x` — satisfy
  // this project's `exactOptionalPropertyTypes` tsconfig setting, which
  // otherwise rejects assigning an explicit `undefined` to a merely-optional
  // property.
  office?: string | undefined;
  violationType?: string | undefined;
  emailStatus?: string | undefined;
  employeeEmail?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

function toQuery(
  filters: ViolationFilters,
  extra?: Record<string, string | number>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.office) params.set("office", filters.office);
  if (filters.violationType) params.set("violation_type", filters.violationType);
  if (filters.emailStatus) params.set("email_status", filters.emailStatus);
  if (filters.employeeEmail) params.set("employee_email", filters.employeeEmail);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  for (const [key, value] of Object.entries(extra ?? {})) {
    params.set(key, String(value));
  }
  return params;
}

export type PaginatedViolations = { items: ViolationRecord[]; total: number };

export async function fetchViolations(
  filters: ViolationFilters,
  page: number,
  pageSize: number,
): Promise<PaginatedViolations> {
  const params = toQuery(filters, { limit: pageSize, offset: page * pageSize });
  const data = await request<{ items: BackendViolationRecord[]; total: number }>(
    `/violations?${params.toString()}`,
  );
  return { items: data.items.map(fromBackend), total: data.total };
}

export async function fetchViolation(id: number): Promise<ViolationRecordDetail> {
  const row = await request<BackendViolationRecordDetail>(`/violations/${id}`);
  return detailFromBackend(row);
}

export type ActivityLogEntry = {
  id: number;
  actorLabel: string;
  action: string;
  createdAt: string;
};

export async function fetchViolationHistory(id: number): Promise<ActivityLogEntry[]> {
  const rows = await request<
    { id: number; actor_label: string; action: string; created_at: string }[]
  >(`/violations/${id}/history`);
  return rows.map((r) => ({
    id: r.id,
    actorLabel: r.actor_label,
    action: r.action,
    createdAt: r.created_at,
  }));
}

export type NewViolationInput = {
  office: Office;
  employeeName: string;
  employeeEmail: string;
  violationType: ViolationType;
  violationTypeOther?: string;
  violationDate: string;
  reason?: string;
};

function toCreatePayload(input: NewViolationInput) {
  return {
    office: input.office,
    employee_name: input.employeeName,
    employee_email: input.employeeEmail,
    violation_type: input.violationType,
    violation_type_other: input.violationTypeOther || undefined,
    violation_date: input.violationDate,
    reason: input.reason || undefined,
  };
}

export async function createViolation(input: NewViolationInput): Promise<ViolationRecord> {
  const row = await request<BackendViolationRecord>("/violations", {
    method: "POST",
    body: JSON.stringify(toCreatePayload(input)),
  });
  return fromBackend(row);
}

export type ViolationUpdateInput = Partial<{
  office: Office;
  employeeName: string;
  employeeEmail: string;
  violationType: ViolationType;
  violationTypeOther: string;
  violationDate: string;
  reason: string;
  ccAddresses: string;
  fromAddress: string;
  // `undefined` (the default, via Partial) = leave whatever's stored
  // untouched. `null` = reset to auto-detecting from the logs. An array =
  // use exactly this list instead. See edit-violation-dialog.tsx.
  previousViolationsOverride: PreviousViolationEntry[] | null;
}>;

export async function updateViolation(
  id: number,
  changes: ViolationUpdateInput,
): Promise<ViolationRecord> {
  const payload: Record<string, unknown> = {};
  if (changes.office !== undefined) payload["office"] = changes.office;
  if (changes.employeeName !== undefined) payload["employee_name"] = changes.employeeName;
  if (changes.employeeEmail !== undefined) payload["employee_email"] = changes.employeeEmail;
  if (changes.violationType !== undefined) payload["violation_type"] = changes.violationType;
  if (changes.violationTypeOther !== undefined)
    payload["violation_type_other"] = changes.violationTypeOther;
  if (changes.violationDate !== undefined) payload["violation_date"] = changes.violationDate;
  if (changes.reason !== undefined) payload["reason"] = changes.reason;
  if (changes.ccAddresses !== undefined) payload["cc_addresses"] = changes.ccAddresses;
  if (changes.fromAddress !== undefined) payload["from_address"] = changes.fromAddress;
  if ("previousViolationsOverride" in changes) {
    payload["previous_violations_override"] =
      changes.previousViolationsOverride === null
        ? null
        : changes.previousViolationsOverride?.map((e) => ({
            violation_date: e.violationDate,
            violation_type: e.violationType,
            violation_type_other: e.violationTypeOther,
          }));
  }

  const row = await request<BackendViolationRecord>(`/violations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return fromBackend(row);
}

async function transition(id: number, action: string): Promise<ViolationRecord> {
  const row = await request<BackendViolationRecord>(`/violations/${id}/${action}`, {
    method: "POST",
  });
  return fromBackend(row);
}

export const prepareViolation = (id: number) => transition(id, "prepare");
export const markReadyViolation = (id: number) => transition(id, "mark-ready");
export const approveViolation = (id: number) => transition(id, "approve");
export const holdViolation = (id: number) => transition(id, "hold");
export const needsCorrectionViolation = (id: number) => transition(id, "needs-correction");
export const resendViolation = (id: number) => transition(id, "resend");
export const sendNowViolation = (id: number) => transition(id, "send-now");

export async function deleteViolation(id: number): Promise<void> {
  await request<void>(`/violations/${id}`, { method: "DELETE" });
}

export type BulkSkip = { id: number; violationRecordId: string | null; reason: string };
export type BulkDeleteResult = { deleted: number[]; skipped: BulkSkip[] };

function skipFromBackend(s: {
  id: number;
  violation_record_id: string | null;
  reason: string;
}): BulkSkip {
  return { id: s.id, violationRecordId: s.violation_record_id, reason: s.reason };
}

export async function bulkDeleteViolations(ids: number[]): Promise<BulkDeleteResult> {
  const result = await request<{
    deleted: number[];
    skipped: { id: number; violation_record_id: string | null; reason: string }[];
  }>("/violations/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
  return { deleted: result.deleted, skipped: result.skipped.map(skipFromBackend) };
}

export async function bulkPreviewViolations(ids: number[]): Promise<ViolationRecordDetail[]> {
  const rows = await request<BackendViolationRecordDetail[]>("/violations/bulk-preview", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  return rows.map(detailFromBackend);
}

export type BulkSendOutcome = {
  id: number;
  violationRecordId: string;
  employeeName: string;
  error: string | null;
};
export type BulkSendResult = {
  sent: BulkSendOutcome[];
  failed: BulkSendOutcome[];
  skipped: BulkSkip[];
};

function outcomeFromBackend(o: {
  id: number;
  violation_record_id: string;
  employee_name: string;
  error: string | null;
}): BulkSendOutcome {
  return {
    id: o.id,
    violationRecordId: o.violation_record_id,
    employeeName: o.employee_name,
    error: o.error,
  };
}

export async function bulkSendNowViolations(ids: number[]): Promise<BulkSendResult> {
  const result = await request<{
    sent: {
      id: number;
      violation_record_id: string;
      employee_name: string;
      error: string | null;
    }[];
    failed: {
      id: number;
      violation_record_id: string;
      employee_name: string;
      error: string | null;
    }[];
    skipped: { id: number; violation_record_id: string | null; reason: string }[];
  }>("/violations/bulk-send-now", { method: "POST", body: JSON.stringify({ ids }) });
  return {
    sent: result.sent.map(outcomeFromBackend),
    failed: result.failed.map(outcomeFromBackend),
    skipped: result.skipped.map(skipFromBackend),
  };
}

// --- MS Outlook alternate send path (see backend/app/models/app_settings.py's
// use_outlook_for_violations) — marks a record Sent without calling Zoho Mail
// at all; the caller is responsible for opening the actual mailto: compose
// window from the returned preview fields (see @/lib/mailto). ---

export async function sendViaOutlook(
  id: number,
  overrides: { fromAddress?: string; ccAddresses?: string },
): Promise<ViolationRecordDetail> {
  const payload: Record<string, unknown> = {};
  if (overrides.fromAddress !== undefined) payload["from_address"] = overrides.fromAddress;
  if (overrides.ccAddresses !== undefined) payload["cc_addresses"] = overrides.ccAddresses;
  const row = await request<BackendViolationRecordDetail>(`/violations/${id}/send-via-outlook`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return detailFromBackend(row);
}

export type BulkSendViaOutlookResult = { sent: ViolationRecordDetail[]; skipped: BulkSkip[] };

export async function bulkSendViaOutlook(ids: number[]): Promise<BulkSendViaOutlookResult> {
  const result = await request<{
    sent: BackendViolationRecordDetail[];
    skipped: { id: number; violation_record_id: string | null; reason: string }[];
  }>("/violations/bulk-send-via-outlook", { method: "POST", body: JSON.stringify({ ids }) });
  return { sent: result.sent.map(detailFromBackend), skipped: result.skipped.map(skipFromBackend) };
}

export type EmailSenderConfig = { fromAddress: string; knownFromAddresses: string[] };

export async function fetchEmailSenderConfig(): Promise<EmailSenderConfig> {
  const data = await request<{ from_address: string; known_from_addresses: string[] }>(
    "/violations/email-sender-config",
  );
  return { fromAddress: data.from_address, knownFromAddresses: data.known_from_addresses };
}

// --- Import ---------------------------------------------------------------

export type ImportPreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  office: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  violationType: string | null;
  violationDate: string | null;
  reason: string | null;
};

export type ImportPreviewResult = {
  filename: string;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  rows: ImportPreviewRow[];
};

type BackendImportPreviewRow = {
  row_number: number;
  valid: boolean;
  errors: string[];
  office: string | null;
  employee_name: string | null;
  employee_email: string | null;
  violation_type: string | null;
  violation_date: string | null;
  reason: string | null;
};

export async function previewImport(file: File): Promise<ImportPreviewResult> {
  const form = new FormData();
  form.append("file", file);
  const data = await request<{
    filename: string;
    row_count: number;
    valid_count: number;
    invalid_count: number;
    rows: BackendImportPreviewRow[];
  }>("/violations/import/preview", { method: "POST", body: form });
  return {
    filename: data.filename,
    rowCount: data.row_count,
    validCount: data.valid_count,
    invalidCount: data.invalid_count,
    rows: data.rows.map((r) => ({
      rowNumber: r.row_number,
      valid: r.valid,
      errors: r.errors,
      office: r.office,
      employeeName: r.employee_name,
      employeeEmail: r.employee_email,
      violationType: r.violation_type,
      violationDate: r.violation_date,
      reason: r.reason,
    })),
  };
}

export type ImportResult = {
  batchId: number;
  rowCount: number;
  successCount: number;
  errorCount: number;
};

export async function commitImport(
  filename: string,
  rows: ImportPreviewRow[],
): Promise<ImportResult> {
  const payload = {
    filename,
    rows: rows.map((r) => ({
      row_number: r.rowNumber,
      office: r.office ?? "PH",
      employee_name: r.employeeName ?? "",
      employee_email: r.employeeEmail ?? "",
      violation_type: r.violationType ?? "",
      violation_date: r.violationDate ?? "",
      reason: r.reason ?? "No reason given",
    })),
  };
  const data = await request<{
    batch_id: number;
    row_count: number;
    success_count: number;
    error_count: number;
  }>("/violations/import/commit", { method: "POST", body: JSON.stringify(payload) });
  return {
    batchId: data.batch_id,
    rowCount: data.row_count,
    successCount: data.success_count,
    errorCount: data.error_count,
  };
}

export function exportViolationsUrl(filters: ViolationFilters, format: "xlsx" | "csv"): string {
  const params = toQuery(filters, { format });
  return apiUrl(`/violations/export?${params.toString()}`);
}

// --- Analytics --------------------------------------------------------------

export type AnalyticsOverview = {
  totalRecords: number;
  pendingPreparation: number;
  pendingApproval: number;
  sentThisMonth: number;
  failedCount: number;
  byViolationType: Record<string, number>;
  byOffice: Record<string, number>;
  byMonth: Record<string, number>;
  topEmployees: { employeeName: string; count: number }[];
  avgApprovalTurnaroundMinutes: number | null;
};

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const data = await request<{
    total_records: number;
    pending_preparation: number;
    pending_approval: number;
    sent_this_month: number;
    failed_count: number;
    by_violation_type: Record<string, number>;
    by_office: Record<string, number>;
    by_month: Record<string, number>;
    top_employees: { employee_name: string; count: number }[];
    avg_approval_turnaround_minutes: number | null;
  }>("/violation-analytics/overview");
  return {
    totalRecords: data.total_records,
    pendingPreparation: data.pending_preparation,
    pendingApproval: data.pending_approval,
    sentThisMonth: data.sent_this_month,
    failedCount: data.failed_count,
    byViolationType: data.by_violation_type,
    byOffice: data.by_office,
    byMonth: data.by_month,
    topEmployees: data.top_employees.map((e) => ({
      employeeName: e.employee_name,
      count: e.count,
    })),
    avgApprovalTurnaroundMinutes: data.avg_approval_turnaround_minutes,
  };
}

// --- Reports ------------------------------------------------------------

export type ReportPreviewRow = {
  violationRecordId: string;
  office: Office;
  employeeName: string;
  employeeEmail: string;
  violationType: string;
  violationDate: string | null;
  emailStatus: EmailStatus;
  sentAt: string | null;
};

export type ReportPreview = {
  total: number;
  byStatus: Record<string, number>;
  byViolationType: Record<string, number>;
  byOffice: Record<string, number>;
  rows: ReportPreviewRow[];
  truncated: boolean;
};

export async function fetchReportPreview(filters: ViolationFilters): Promise<ReportPreview> {
  const params = toQuery(filters);
  const data = await request<{
    total: number;
    by_status: Record<string, number>;
    by_violation_type: Record<string, number>;
    by_office: Record<string, number>;
    rows: {
      violation_record_id: string;
      office: Office;
      employee_name: string;
      employee_email: string;
      violation_type: string;
      violation_date: string | null;
      email_status: EmailStatus;
      sent_at: string | null;
    }[];
    truncated: boolean;
  }>(`/violation-reports/preview?${params.toString()}`);
  return {
    total: data.total,
    byStatus: data.by_status,
    byViolationType: data.by_violation_type,
    byOffice: data.by_office,
    rows: data.rows.map((r) => ({
      violationRecordId: r.violation_record_id,
      office: r.office,
      employeeName: r.employee_name,
      employeeEmail: r.employee_email,
      violationType: r.violation_type,
      violationDate: r.violation_date,
      emailStatus: r.email_status,
      sentAt: r.sent_at,
    })),
    truncated: data.truncated,
  };
}

export function reportDownloadUrl(filters: ViolationFilters, format: "xlsx" | "pdf"): string {
  const params = toQuery(filters, { format });
  return apiUrl(`/violation-reports/generate?${params.toString()}`);
}
