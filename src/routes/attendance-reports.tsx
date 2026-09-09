import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, FileBarChart, FileDown, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { FilterSelect } from "@/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EMAIL_STATUSES,
  OFFICES,
  VIOLATION_TYPES,
  fetchReportPreview,
  reportDownloadUrl,
  type ReportPreview,
  type ViolationFilters,
} from "@/data/violation-api";

// Reports are generated server-side (backend/app/services/violation_reports.py,
// via pandas/openpyxl/reportlab) exactly as the standalone attendance app did
// it — the "Generate Report" button just opens a download URL rather than
// building the file client-side, ported from that app's src/pages/Reports.tsx.
export const Route = createFileRoute("/attendance-reports")({
  head: () => ({
    meta: [
      { title: "Attendance Reports — TGO Workforce" },
      {
        name: "description",
        content: "Filter and generate formatted attendance violation summary reports (xlsx/pdf).",
      },
      { property: "og:title", content: "Attendance Reports — TGO Workforce" },
      {
        property: "og:description",
        content: "Attendance violation summary reports for TGO Workforce.",
      },
    ],
  }),
  component: AttendanceReportsPage,
});

function topCount(counts: Record<string, number>) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function AttendanceReportsPage() {
  const [office, setOffice] = useState("all");
  const [violationType, setViolationType] = useState("all");
  const [emailStatus, setEmailStatus] = useState("all");
  const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx");
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  const filters = (): ViolationFilters => ({
    office: office === "all" ? undefined : office,
    violationType: violationType === "all" ? undefined : violationType,
    emailStatus: emailStatus === "all" ? undefined : emailStatus,
  });

  const previewMutation = useMutation({
    mutationFn: () => fetchReportPreview(filters()),
    onSuccess: setPreview,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't build a preview"),
  });

  function clearFilter(patch: () => void) {
    patch();
    setPreview(null);
  }

  const hasActiveFilters = office !== "all" || violationType !== "all" || emailStatus !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        description="Filter and download a formatted summary report of attendance violation records."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Generate report</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Filter and download a formatted summary (counts by status/type/office plus the matching records) — for a
              raw data dump instead, use Export from the Attendance Violations page.
            </p>
            <div className="flex flex-col gap-3">
              <FilterSelect
                value={office}
                onChange={(v) => clearFilter(() => setOffice(v))}
                placeholder="Office"
                allLabel="All offices"
                options={[...OFFICES]}
              />
              <FilterSelect
                value={violationType}
                onChange={(v) => clearFilter(() => setViolationType(v))}
                placeholder="Violation type"
                allLabel="All violation types"
                options={VIOLATION_TYPES.filter((v) => v !== "Other")}
              />
              <FilterSelect
                value={emailStatus}
                onChange={(v) => clearFilter(() => setEmailStatus(v))}
                placeholder="Status"
                allLabel="All statuses"
                options={[...EMAIL_STATUSES]}
              />
              <Select value={format} onValueChange={(v) => setFormat(v as "xlsx" | "pdf")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                {previewMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                Preview
              </Button>
              <Button onClick={() => window.open(reportDownloadUrl(filters(), format), "_blank")}>
                <FileDown className="size-4" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {!preview && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <FileBarChart className="size-8" />
                <p className="text-sm">
                  {hasActiveFilters
                    ? "Filters set — click Preview to see what matches."
                    : "Pick filters on the left, then Preview or Generate Report."}
                </p>
              </CardContent>
            </Card>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard title="Matching records" value={preview.total} hint="This filter" icon={FileBarChart} />
                <MetricCard
                  title="Statuses represented"
                  value={Object.keys(preview.byStatus).length}
                  hint={`of ${topCount(preview.byStatus)} total`}
                  icon={FileBarChart}
                />
                <MetricCard
                  title="Violation types"
                  value={Object.keys(preview.byViolationType).length}
                  hint="Distinct types"
                  icon={FileBarChart}
                />
                <MetricCard title="Offices" value={Object.keys(preview.byOffice).length} hint="Distinct offices" icon={FileBarChart} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryGroup title="By status" counts={preview.byStatus} />
                <SummaryGroup title="By violation type" counts={preview.byViolationType} />
                <SummaryGroup title="By office" counts={preview.byOffice} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Preview — {preview.total} matching record{preview.total === 1 ? "" : "s"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-0">
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Office</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((r) => (
                          <TableRow key={r.violationRecordId}>
                            <TableCell>
                              <div>{r.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{r.employeeEmail}</div>
                            </TableCell>
                            <TableCell>{r.violationType}</TableCell>
                            <TableCell>{r.violationDate}</TableCell>
                            <TableCell>{r.office}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{r.emailStatus}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {preview.rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No records match these filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {preview.truncated && (
                    <p className="px-4 pb-4 text-xs text-muted-foreground">
                      Showing the first {preview.rows.length} of {preview.total} — the actual report download isn't
                      capped.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryGroup({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {entries.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span className="truncate">{k}</span>
                <span className="shrink-0 font-medium text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
