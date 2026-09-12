import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Download, FileSpreadsheet, FileText, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DepartmentDistributionChart,
  HeadcountGrowthChart,
  HeadcountTrendChart,
  MonthlyHiringTrendChart,
  OfficeDistributionChart,
  StatusDistributionChart,
  TenureDistributionChart,
} from "@/components/workforce-charts";
import { exportAnalyticsPdf, exportAnalyticsXlsx, type AnalyticsExportData } from "@/lib/analytics-export";
import {
  DEPARTMENTS,
  OFFICES,
  STATUSES,
  departmentDistribution,
  headcountGrowth,
  headcountTrend,
  monthlyHiringTrend,
  officeDistribution,
  parseCalendarDate,
  statusDistribution,
  tenureDistribution,
  type DateRange,
} from "@/data/employees";
import { useEmployees } from "@/data/employee-store";
import { computeStatus, type NewHire, type OnboardingStatus } from "@/data/new-hire-api";
import { useNewHires } from "@/data/new-hire-store";
import {
  OFFICES as VIOLATION_OFFICES,
  VIOLATION_TYPES,
  type ViolationRecord,
} from "@/data/violation-api";
import { useViolationsQuery } from "@/data/violation-store";
import { ROLE_LABELS } from "@/lib/roles";
import { useCurrentAccount } from "@/lib/session";
import { getEffectiveRole, isFullAccessRole } from "@/lib/permissions";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content:
          "Charts covering hiring trend, headcount growth, onboarding completion and attendance violations across every module.",
      },
      { property: "og:title", content: "Analytics — Torero Global Outsourcing HR Operations" },
      {
        property: "og:description",
        content:
          "Cross-module visual breakdown of headcount, onboarding progress and attendance violations.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const checklistConfig = {
  count: { label: "New hires" },
} satisfies ChartConfig;

const CHECKLIST_STEPS: { key: keyof NewHire; label: string }[] = [
  { key: "joDiscussion", label: "JO Discussion" },
  { key: "confirmationSigned", label: "Confirmation Signed" },
  { key: "welcomeEmailSent", label: "Welcome Email Sent" },
  { key: "newHireInfo", label: "New Hire Info" },
  { key: "idPhoto", label: "ID Photo" },
  { key: "credentialsCreated", label: "Credentials Created" },
  { key: "onboardingDay", label: "Onboarding Day" },
];

const ONBOARDING_STATUSES: OnboardingStatus[] = ["Not Started", "In Progress", "Complete"];

/** "YYYY-MM-DD" from local date parts — not toISOString(), which converts to
 * UTC first and can drift the date by one depending on the viewer's
 * timezone (same class of bug @/data/employees' parseCalendarDate exists to
 * avoid). Only used to seed the date inputs' defaults; every value the user
 * actually picks comes back through the same "YYYY-MM-DD" shape natively. */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const violationTypeConfig = {
  count: { label: "Violations", color: "var(--chart-1)" },
} satisfies ChartConfig;

const violationOfficeConfig = {
  PH: { label: "PH", color: "var(--chart-1)" },
  CO: { label: "CO", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Onboarding tab's one chart, now filtered by whichever checklist-completion
 * statuses are checked in the tab's own filter bar — takes `hires` as a prop
 * (rather than calling useNewHires() itself) so the caller controls scope. */
function OnboardingCompletionChart({ hires }: { hires: NewHire[] }) {
  const data = CHECKLIST_STEPS.map((field) => ({
    step: field.label,
    count: hires.filter((h) => h[field.key]).length,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding Checklist Completion</CardTitle>
        <CardDescription>How many new hires have completed each step</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={checklistConfig} className="h-[280px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="step" width={140} tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--chart-1)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** Attendance tab's two charts, computed client-side from the filtered
 * `violations` list passed in — previously these read a fixed backend
 * aggregate (GET /violation-analytics/overview) that had no filter params;
 * aggregating from the already-fetched raw records here instead means the
 * tab's Office/Type filters actually take effect with no backend change. */
function ViolationsByTypeChart({ violations }: { violations: ViolationRecord[] }) {
  const counts = new Map<string, number>();
  for (const v of violations) {
    counts.set(v.violationTypeLabel, (counts.get(v.violationTypeLabel) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([type, count]) => ({ type, count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Violations by Type</CardTitle>
        <CardDescription>Attendance violation records by category</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={violationTypeConfig} className="h-[280px] w-full">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--chart-1)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ViolationsByOfficeChart({ violations }: { violations: ViolationRecord[] }) {
  const counts = new Map<string, number>();
  for (const v of violations) {
    counts.set(v.office, (counts.get(v.office) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([office, count]) => ({
    office,
    count,
    fill: `var(--color-${office})`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Violations by Office</CardTitle>
        <CardDescription>PH vs. CO split of open and closed violations</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <ChartContainer config={violationOfficeConfig} className="h-[280px] w-full max-w-[320px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={rows} dataKey="count" nameKey="office" innerRadius={50} outerRadius={90}>
              {rows.map((row) => (
                <Cell key={row.office} fill={row.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function AnalyticsPage() {
  const employees = useEmployees();
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const isAdmin = isFullAccessRole(getEffectiveRole(account));

  const allHires = useNewHires(isAdmin);
  const { data: violationsPage } = useViolationsQuery({}, 0, 500, isAdmin);
  const allViolations = violationsPage?.items ?? [];

  // Each tab keeps its own filter state — the three tabs don't share a
  // filterable dimension in common (violations don't have a department,
  // new hires don't have an office), so one shared bar would just show
  // controls that do nothing on two of the three tabs.
  const [workforceOffice, setWorkforceOffice] = useState<string[]>([]);
  const [workforceDepartment, setWorkforceDepartment] = useState<string[]>([]);
  const [workforceStatus, setWorkforceStatus] = useState<string[]>([]);
  // The trend charts (Monthly Hiring Trend, Headcount Growth, Headcount
  // Trend) plot a span of months, not a single filterable value — a real
  // calendar From/To, defaulting to the trailing 12 months, so the window
  // they show is a genuine user-controlled range rather than a fixed "last N
  // months from today".
  const [trendFrom, setTrendFrom] = useState(() =>
    toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1)),
  );
  const [trendTo, setTrendTo] = useState(() => toDateInputValue(new Date()));
  const [onboardingStatus, setOnboardingStatus] = useState<string[]>([]);
  const [attendanceOffice, setAttendanceOffice] = useState<string[]>([]);
  const [attendanceType, setAttendanceType] = useState<string[]>([]);

  // "YYYY-MM-DD" strings compare correctly with plain <=, no Date parsing
  // needed just to validate ordering.
  const trendRangeValid = trendFrom <= trendTo;
  const trendRange: DateRange | undefined = trendRangeValid
    ? { from: parseCalendarDate(trendFrom), to: parseCalendarDate(trendTo) }
    : undefined;

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          (workforceOffice.length === 0 || workforceOffice.includes(e.office)) &&
          (workforceDepartment.length === 0 || workforceDepartment.includes(e.department)) &&
          (workforceStatus.length === 0 || workforceStatus.includes(e.status)),
      ),
    [employees, workforceOffice, workforceDepartment, workforceStatus],
  );

  const filteredHires = useMemo(
    () =>
      onboardingStatus.length === 0
        ? allHires
        : allHires.filter((h) => onboardingStatus.includes(computeStatus(h))),
    [allHires, onboardingStatus],
  );

  const filteredViolations = useMemo(
    () =>
      allViolations.filter(
        (v) =>
          (attendanceOffice.length === 0 || attendanceOffice.includes(v.office)) &&
          (attendanceType.length === 0 || attendanceType.includes(v.violationTypeLabel)),
      ),
    [allViolations, attendanceOffice, attendanceType],
  );

  const [exporting, setExporting] = useState(false);

  function buildExportData(): AnalyticsExportData {
    const filterLines: string[] = [];
    if (workforceOffice.length) filterLines.push(`Workforce · Office: ${workforceOffice.join(", ")}`);
    if (workforceDepartment.length)
      filterLines.push(`Workforce · Department: ${workforceDepartment.join(", ")}`);
    if (workforceStatus.length) filterLines.push(`Workforce · Status: ${workforceStatus.join(", ")}`);
    filterLines.push(
      `Workforce · Trend charts date range: ${trendFrom} to ${trendTo}${trendRangeValid ? "" : " (invalid — showing default 12-month window instead)"}`,
    );
    if (onboardingStatus.length)
      filterLines.push(`Onboarding · Checklist status: ${onboardingStatus.join(", ")}`);
    if (attendanceOffice.length) filterLines.push(`Attendance · Office: ${attendanceOffice.join(", ")}`);
    if (attendanceType.length) filterLines.push(`Attendance · Violation type: ${attendanceType.join(", ")}`);

    const active = filteredEmployees.filter((e) => e.status === "Active").length;
    const resigned = filteredEmployees.filter((e) => e.status === "Resigned").length;
    const terminated = filteredEmployees.filter((e) => e.status === "Terminated").length;

    const office = officeDistribution(filteredEmployees);
    const status = statusDistribution(filteredEmployees);
    const department = departmentDistribution(filteredEmployees);
    const tenure = tenureDistribution(filteredEmployees);
    const hiring = monthlyHiringTrend(filteredEmployees, trendRange);
    const growth = headcountGrowth(filteredEmployees, trendRange);
    const trend = headcountTrend(filteredEmployees, trendRange);

    const checklist = CHECKLIST_STEPS.map((field) => ({
      step: field.label,
      count: filteredHires.filter((h) => h[field.key]).length,
    }));

    const byTypeCounts = new Map<string, number>();
    for (const v of filteredViolations) {
      byTypeCounts.set(v.violationTypeLabel, (byTypeCounts.get(v.violationTypeLabel) ?? 0) + 1);
    }
    const byOfficeCounts = new Map<string, number>();
    for (const v of filteredViolations) {
      byOfficeCounts.set(v.office, (byOfficeCounts.get(v.office) ?? 0) + 1);
    }

    return {
      filterLines,
      summary: [
        { label: "Total Employees (filtered)", value: filteredEmployees.length },
        { label: "Active", value: active },
        { label: "Resigned", value: resigned },
        { label: "Terminated", value: terminated },
        { label: "New Hires Tracked (filtered)", value: filteredHires.length },
        { label: "Attendance Records (filtered)", value: filteredViolations.length },
      ],
      sections: [
        {
          title: "Office Distribution",
          columns: ["Office", "Active", "Inactive"],
          rows: office.map((r) => [r.office, r.active, r.inactive]),
        },
        {
          title: "Status Distribution",
          columns: ["Status", "Count"],
          rows: status.map((r) => [r.status, r.count]),
        },
        {
          title: "Department Distribution",
          columns: ["Department", "Active", "Inactive"],
          rows: department.map((r) => [r.department, r.active, r.inactive]),
        },
        {
          title: "Tenure Distribution",
          columns: ["Tenure Band", "Employees"],
          rows: tenure.map((r) => [r.band, r.employees]),
        },
        {
          title: "Monthly Hiring Trend",
          columns: ["Month", "Hires", "Exits"],
          rows: hiring.map((r) => [r.month, r.hires, r.exits]),
        },
        {
          title: "Headcount Growth",
          columns: ["Month", "Active Headcount"],
          rows: growth.map((r) => [r.month, r.headcount]),
        },
        {
          title: "Headcount Trend (6mo)",
          columns: ["Month", "Headcount"],
          rows: trend.map((r) => [r.month, r.headcount]),
        },
        {
          title: "Onboarding Checklist Completion",
          columns: ["Step", "New Hires Completed"],
          rows: checklist.map((r) => [r.step, r.count]),
        },
        {
          title: "Violations by Type",
          columns: ["Violation Type", "Count"],
          rows: [...byTypeCounts.entries()],
        },
        {
          title: "Violations by Office",
          columns: ["Office", "Count"],
          rows: [...byOfficeCounts.entries()],
        },
      ],
    };
  }

  async function handleExport(format: "xlsx" | "pdf") {
    setExporting(true);
    try {
      const data = buildExportData();
      if (format === "xlsx") await exportAnalyticsXlsx(data);
      else await exportAnalyticsPdf(data);
      toast.success(`Analytics report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // Analytics rolls up numbers across every module (Employee Directory,
  // Onboarding, Attendance) — no single module-siloed role should see the
  // full cross-module picture, only Admin. Same wall pattern as
  // user-management.tsx; the nav item is also hidden for non-admins (see
  // app-sidebar.tsx's adminOnly flag), this is the page's own enforcement of
  // that in case someone navigates here directly by URL.
  if (accountLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Cross-module reporting." />
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Cross-module reporting." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Admins only</p>
              <p className="text-sm text-muted-foreground">
                Your account ({account ? ROLE_LABELS[account.role] : "signed out"}) doesn't have
                access to this page. Ask an existing admin if you need it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Hiring, onboarding progress and attendance analysis across every module."
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={exporting} onSelect={() => handleExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting} onSelect={() => handleExport("pdf")}>
                <FileText className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Tabs defaultValue="workforce">
        <TabsList>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="workforce" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <MultiSelectFilter
              label="Office"
              selected={workforceOffice}
              onChange={setWorkforceOffice}
              options={[...OFFICES]}
            />
            <MultiSelectFilter
              label="Department"
              selected={workforceDepartment}
              onChange={setWorkforceDepartment}
              options={[...DEPARTMENTS]}
            />
            <MultiSelectFilter
              label="Status"
              selected={workforceStatus}
              onChange={setWorkforceStatus}
              options={[...STATUSES]}
            />
            <div className="flex items-end gap-2">
              <div className="grid gap-1">
                <Label htmlFor="trend-from" className="text-xs text-muted-foreground">
                  Trend charts: from
                </Label>
                <Input
                  id="trend-from"
                  type="date"
                  value={trendFrom}
                  onChange={(e) => setTrendFrom(e.target.value)}
                  className="h-9 w-[150px]"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="trend-to" className="text-xs text-muted-foreground">
                  to
                </Label>
                <Input
                  id="trend-to"
                  type="date"
                  value={trendTo}
                  onChange={(e) => setTrendTo(e.target.value)}
                  className="h-9 w-[150px]"
                />
              </div>
            </div>
            {(workforceOffice.length > 0 || workforceDepartment.length > 0 || workforceStatus.length > 0) && (
              <span className="text-xs text-muted-foreground">
                Showing {filteredEmployees.length} of {employees.length} employees
              </span>
            )}
          </div>
          {!trendRangeValid && (
            <p className="text-xs text-destructive">
              "From" must be on or before "to" — the trend charts below are showing their default
              12-month window until this is fixed.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <MonthlyHiringTrendChart employees={filteredEmployees} range={trendRange} />
            <HeadcountGrowthChart employees={filteredEmployees} range={trendRange} />
            <DepartmentDistributionChart employees={filteredEmployees} />
            <TenureDistributionChart employees={filteredEmployees} />
            <OfficeDistributionChart employees={filteredEmployees} />
            <StatusDistributionChart employees={filteredEmployees} />
          </div>
          <HeadcountTrendChart employees={filteredEmployees} range={trendRange} />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Checklist status"
              selected={onboardingStatus}
              onChange={setOnboardingStatus}
              options={[...ONBOARDING_STATUSES]}
            />
            {onboardingStatus.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Showing {filteredHires.length} of {allHires.length} new hires
              </span>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OnboardingCompletionChart hires={filteredHires} />
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Office"
              selected={attendanceOffice}
              onChange={setAttendanceOffice}
              options={[...VIOLATION_OFFICES]}
            />
            <MultiSelectFilter
              label="Violation type"
              selected={attendanceType}
              onChange={setAttendanceType}
              options={[...VIOLATION_TYPES]}
            />
            {(attendanceOffice.length > 0 || attendanceType.length > 0) && (
              <span className="text-xs text-muted-foreground">
                Showing {filteredViolations.length} of {allViolations.length} records
              </span>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ViolationsByTypeChart violations={filteredViolations} />
            <ViolationsByOfficeChart violations={filteredViolations} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
