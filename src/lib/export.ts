// Shared CSV/Excel/PDF export for the Employee Directory's "Export Options"
// menu (see employee-table.tsx). Every export function takes exactly the
// rows to write out — the caller decides whether that's the checkbox
// selection or everything currently visible, this file just turns a list of
// Employees into a downloaded file. Excel/PDF libraries are dynamically
// imported so their (non-trivial) bundle size only loads when someone
// actually exports, matching the pattern already used for xlsx importing.

import type { Employee } from "@/data/employees";
import { formatDate } from "@/data/employees";

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
