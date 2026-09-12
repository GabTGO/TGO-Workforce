// Excel/PDF export for the Analytics page (src/routes/analytics.tsx) —
// exports whatever the three tabs' underlying data currently is, respecting
// whatever filters are active at the moment of export. Mirrors the design
// language already established in @/lib/export.ts (the Employee Directory's
// export): dark header band, striped rows, timestamped filename, dynamically
// imported libraries so the ~1MB of xlsx/jspdf never loads until someone
// actually exports.

const COMPANY_NAME = "Torero Global Outsourcing";
const REPORT_TITLE = "HR Operations — Analytics Report";

// Same dark-slate header used by the Employee Directory's PDF export —
// matches this app's --secondary token so a printed report still reads as
// "this app", not a generic jspdf default.
const HEADER_FILL: [number, number, number] = [30, 41, 59];
const STRIPE_FILL: [number, number, number] = [248, 250, 252];

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

function timestampedName(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export type AnalyticsExportSection = {
  /** Sheet name (Excel) / section heading (PDF). */
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export type AnalyticsExportData = {
  /** One line per active filter, e.g. "Office: PH Eastwood, CO Medellin" —
   * shown on the report cover so a reader knows exactly what scope this
   * export covers without having to ask. Empty array = no filters applied. */
  filterLines: string[];
  summary: { label: string; value: string | number }[];
  sections: AnalyticsExportSection[];
};

export async function exportAnalyticsXlsx(
  data: AnalyticsExportData,
  baseName = "TGO_Analytics_Report",
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    [REPORT_TITLE],
    [`Generated ${new Date().toLocaleString()}`],
    [],
    ...(data.filterLines.length > 0
      ? [["Filters applied"], ...data.filterLines.map((line) => [line]), []]
      : [["No filters applied — full dataset"], []]),
    ["Metric", "Value"],
    ...data.summary.map((s) => [s.label, s.value]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 32 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  for (const section of data.sections) {
    const sheet = XLSX.utils.aoa_to_sheet([section.columns, ...section.rows]);
    sheet["!cols"] = section.columns.map((c) => ({ wch: Math.max(c.length + 4, 14) }));
    // Sheet names are capped at 31 chars and can't repeat — trim, don't
    // dedupe-suffix, since every section title in this report is unique.
    XLSX.utils.book_append_sheet(workbook, sheet, section.title.slice(0, 31));
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    timestampedName(baseName, "xlsx"),
  );
}

export async function exportAnalyticsPdf(
  data: AnalyticsExportData,
  baseName = "TGO_Analytics_Report",
) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({ orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;

  // --- Cover header, repeated at the top of every page via autoTable's
  // didDrawPage hook below, rather than only once on page 1 — a report
  // that's been printed or scrolled past page 1 should still say what it is.
  function drawHeader() {
    doc.setFillColor(...HEADER_FILL);
    doc.rect(0, 0, pageWidth, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, marginX, 11);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(REPORT_TITLE, marginX, 18);
    doc.setFontSize(8);
    doc.text(
      `Generated ${new Date().toLocaleString()}`,
      pageWidth - marginX,
      11,
      { align: "right" },
    );
    doc.setTextColor(0, 0, 0);
  }

  function drawFooter(pageNumber: number, pageCount: number) {
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Page ${pageNumber} of ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
    doc.setTextColor(0, 0, 0);
  }

  drawHeader();
  let cursorY = 32;

  if (data.filterLines.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Filters applied", marginX, cursorY);
    doc.setFont("helvetica", "normal");
    cursorY += 5;
    for (const line of data.filterLines) {
      doc.text(`• ${line}`, marginX, cursorY);
      cursorY += 5;
    }
    cursorY += 2;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("No filters applied — full dataset", marginX, cursorY);
    doc.setTextColor(0, 0, 0);
    cursorY += 7;
  }

  // Summary metrics as one compact two-column table, always right under the
  // cover info — the "how big is this" numbers a reader wants before
  // scrolling into any one chart's detail.
  autoTable(doc, {
    startY: cursorY,
    head: [["Metric", "Value"]],
    body: data.summary.map((s) => [s.label, String(s.value)]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: HEADER_FILL },
    alternateRowStyles: { fillColor: STRIPE_FILL },
    margin: { left: marginX, right: marginX },
    tableWidth: 100,
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  // @ts-expect-error jspdf-autotable augments the doc instance at runtime
  let cursorAfter: number = doc.lastAutoTable?.finalY ?? cursorY;

  for (const section of data.sections) {
    // A section heading drawn manually (not through autoTable) doesn't get
    // its own page-break check for free — if the previous table ended near
    // the bottom of the page, force a new page here so the title never ends
    // up printed on one page with its table starting on the next.
    let titleY = cursorAfter + 10;
    if (titleY > pageHeight - 30) {
      doc.addPage();
      drawHeader();
      titleY = 32;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, marginX, titleY);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: titleY + 3,
      head: [section.columns],
      body: section.rows.map((row) => row.map(String)),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: HEADER_FILL },
      alternateRowStyles: { fillColor: STRIPE_FILL },
      margin: { left: marginX, right: marginX, top: 28 },
      didDrawPage: () => drawHeader(),
    });

    // @ts-expect-error jspdf-autotable augments the doc instance at runtime
    cursorAfter = doc.lastAutoTable?.finalY ?? titleY;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save(timestampedName(baseName, "pdf"));
}
