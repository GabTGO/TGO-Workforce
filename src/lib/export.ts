// Shared CSV/Excel/PDF export for the Employee Directory's "Export Options"
// menu (see employee-table.tsx). Every export function takes exactly the
// rows to write out — the caller decides whether that's the checkbox
// selection or everything currently visible, this file just turns a list of
// Employees into a downloaded file. Excel/PDF libraries are dynamically
// imported so their (non-trivial) bundle size only loads when someone
// actually exports, matching the pattern already used for xlsx importing.

import type { Employee } from "@/data/employees";
import { formatDate, tenure, tenureDays } from "@/data/employees";

const DATE_KEYS = new Set<keyof Employee>([
  "jobOfferDate",
  "startDate",
  "exitDate",
  "birthday",
]);

const EXPORT_COLUMNS: { key: keyof Employee; label: string }[] = [
  { key: "id", label: "Employee ID" },
  { key: "name", label: "Full Name" },
  { key: "office", label: "Office" },
  { key: "department", label: "Department" },
  { key: "position", label: "Position" },
  { key: "jobOfferDate", label: "Job Offer Date" },
  { key: "startDate", label: "Start Date" },
  { key: "status", label: "Status" },
  { key: "exitDate", label: "Exit Date" },
  { key: "birthday", label: "Birthday" },
  { key: "sourceType", label: "Source" },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return /["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function timestampedName(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export function exportEmployeesCsv(
  employees: Employee[],
  baseName = "employees",
) {
  const header = EXPORT_COLUMNS.map((c) => csvCell(c.label)).join(",");
  const lines = employees.map((e) =>
    EXPORT_COLUMNS.map((c) => csvCell(String(e[c.key] ?? ""))).join(","),
  );
  const csv = [header, ...lines].join("\n");
  triggerDownload(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    timestampedName(baseName, "csv"),
  );
}

export async function exportEmployeesXlsx(
  employees: Employee[],
  baseName = "employees",
) {
  const XLSX = await import("xlsx");
  const rows = employees.map((e) =>
    Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.label, e[c.key] ?? ""])),
  );
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Employees");
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    timestampedName(baseName, "xlsx"),
  );
}

export async function exportEmployeesPdf(
  employees: Employee[],
  baseName = "employees",
) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("TGO Workforce — Employee Directory", 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Exported ${new Date().toLocaleString()} · ${employees.length} record${employees.length === 1 ? "" : "s"}`,
    14,
    21,
  );

  autoTable(doc, {
    startY: 26,
    head: [EXPORT_COLUMNS.map((c) => c.label)],
    body: employees.map((e) =>
      EXPORT_COLUMNS.map((c) => {
        const value = e[c.key];
        if (!value) return "";
        return DATE_KEYS.has(c.key) ? formatDate(String(value)) : String(value);
      }),
    ),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(timestampedName(baseName, "pdf"));
}

// --- Reference report formats -----------------------------------------
// These two match the column layout of the legacy exports TGO People Ops
// already circulates ("TGO_Workforce_Filtered_Export.xlsx" /
// "..._Detailed_Export.xlsx" / "..._Summary_Export.xlsx"), so a file
// produced here drops into the same downstream spreadsheets/process without
// anyone having to remap columns by hand.
//
// Note on "Status": those legacy files use a different status vocabulary
// (e.g. "Termed", "Withdraw", "JO Accepted") than TGO Workforce's own
// Active/Resigned/Terminated states. This export keeps our real status
// values rather than inventing a mapping to statuses our system doesn't
// track — flag it if the team needs those extra states represented.

const DETAILED_COLUMN_LABELS = [
  "Record ID",
  "Employee ID",
  "Full Name",
  "Office Location",
  "Department",
  "Position",
  "Start Date",
  "Tenure",
  "Tenure (Days)",
  "Birthday",
  "Status",
  "Resigned/Termination Date",
  "Source Type",
  "Created At",
  "Updated At",
] as const;

function detailedRow(e: Employee, recordId: number) {
  return {
    [DETAILED_COLUMN_LABELS[0]]: recordId,
    [DETAILED_COLUMN_LABELS[1]]: e.id,
    [DETAILED_COLUMN_LABELS[2]]: e.name,
    [DETAILED_COLUMN_LABELS[3]]: e.office,
    [DETAILED_COLUMN_LABELS[4]]: e.department,
    [DETAILED_COLUMN_LABELS[5]]: e.position,
    [DETAILED_COLUMN_LABELS[6]]: formatDate(e.startDate),
    [DETAILED_COLUMN_LABELS[7]]: tenure(e.startDate, e.exitDate),
    [DETAILED_COLUMN_LABELS[8]]: tenureDays(e.startDate, e.exitDate),
    [DETAILED_COLUMN_LABELS[9]]: formatDate(e.birthday || undefined),
    [DETAILED_COLUMN_LABELS[10]]: e.status,
    [DETAILED_COLUMN_LABELS[11]]: formatDate(e.exitDate),
    [DETAILED_COLUMN_LABELS[12]]: e.sourceType ?? "",
    [DETAILED_COLUMN_LABELS[13]]: formatDate(e.createdAt),
    [DETAILED_COLUMN_LABELS[14]]: formatDate(e.updatedAt),
  };
}

/** "Filtered" and "Detailed" exports in the reference files share this exact
 * 15-column layout — only the row scope differs (current filters/selection
 * vs. every employee), which the caller decides by what it passes in. */
export async function exportEmployeesDetailedXlsx(
  employees: Employee[],
  baseName = "TGO_Workforce_Detailed_Export",
) {
  const XLSX = await import("xlsx");
  const rows = employees.map((e, i) => detailedRow(e, i + 1));
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [...DETAILED_COLUMN_LABELS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Employees");
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    timestampedName(baseName, "xlsx"),
  );
}

/** Two-sheet grouped rollup — "Summary by Team" (Office × Department ×
 * Status counts) and "Summary by Office" (Office counts) — matching
 * TGO_Workforce_Summary_Export.xlsx. */
export async function exportWorkforceSummaryXlsx(
  employees: Employee[],
  baseName = "TGO_Workforce_Summary_Export",
) {
  const XLSX = await import("xlsx");

  const byTeam = new Map<
    string,
    { Office: string; Department: string; Status: string; Count: number }
  >();
  for (const e of employees) {
    const key = `${e.office}|${e.department}|${e.status}`;
    const existing = byTeam.get(key);
    if (existing) existing.Count += 1;
    else
      byTeam.set(key, {
        Office: e.office,
        Department: e.department,
        Status: e.status,
        Count: 1,
      });
  }
  const byTeamRows = [...byTeam.values()].sort(
    (a, b) =>
      a.Office.localeCompare(b.Office) ||
      a.Department.localeCompare(b.Department) ||
      a.Status.localeCompare(b.Status),
  );

  const byOffice = new Map<string, number>();
  for (const e of employees) {
    byOffice.set(e.office, (byOffice.get(e.office) ?? 0) + 1);
  }
  const byOfficeRows = [...byOffice.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([Office, Count]) => ({ Office, Count }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(byTeamRows),
    "Summary by Team",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(byOfficeRows),
    "Summary by Office",
  );
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    timestampedName(baseName, "xlsx"),
  );
}
