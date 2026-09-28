// CSV/PDF export for the HMO Members table (see routes/hmo-management.index.tsx).
// Same dynamic-import-the-PDF-library idiom as @/lib/export.ts, kept as its
// own small file since HmoMember is a different shape than Employee.

import type { HmoMember } from "@/data/hmo-api";

const EXPORT_COLUMNS: { key: keyof HmoMember; label: string }[] = [
  { key: "employeeId", label: "Employee ID" },
  { key: "displayName", label: "Name" },
  { key: "memberType", label: "Member Type" },
  { key: "department", label: "Department" },
  { key: "eligibilityDate", label: "Eligibility Date" },
  { key: "enrollmentStatus", label: "Enrollment Status" },
  { key: "memberStatus", label: "Member Status" },
  { key: "rank", label: "Rank" },
  { key: "hmoCardNumber", label: "HMO Card Number" },
  { key: "virtualCardStatus", label: "Virtual Card" },
  { key: "physicalCardStatus", label: "Physical Card" },
  { key: "monthlyPremium", label: "Monthly Premium" },
  { key: "billingStatus", label: "Billing Status" },
  { key: "removalStatus", label: "Removal Status" },
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

export function exportHmoMembersCsv(members: HmoMember[], baseName = "hmo-members") {
  const header = EXPORT_COLUMNS.map((c) => csvCell(c.label)).join(",");
  const lines = members.map((m) =>
    EXPORT_COLUMNS.map((c) => csvCell(String(m[c.key] ?? ""))).join(","),
  );
  const csv = [header, ...lines].join("\n");
  triggerDownload(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    timestampedName(baseName, "csv"),
  );
}

export async function exportHmoMembersPdf(members: HmoMember[], baseName = "hmo-members") {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Torero Global Outsourcing HR Operations — HMO Management", 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Exported ${new Date().toLocaleString()} · ${members.length} member${members.length === 1 ? "" : "s"}`,
    14,
    21,
  );

  autoTable(doc, {
    startY: 26,
    head: [EXPORT_COLUMNS.map((c) => c.label)],
    body: members.map((m) =>
      EXPORT_COLUMNS.map((c) => {
        const value = m[c.key];
        if (value === null || value === undefined) return "";
        return String(value);
      }),
    ),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(timestampedName(baseName, "pdf"));
}
