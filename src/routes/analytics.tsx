import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useEmployees } from "@/data/employee-store";
import type { NewHire } from "@/data/new-hire-api";
import { useNewHires } from "@/data/new-hire-store";
import { useAnalyticsOverviewQuery } from "@/data/violation-store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — TGO Workforce" },
      {
        name: "description",
        content:
          "Charts covering hiring trend, headcount growth, onboarding completion and attendance violations across TGO.",
      },
      { property: "og:title", content: "Analytics — TGO Workforce" },
      {
        property: "og:description",
        content: "Visual breakdown of TGO headcount, onboarding progress and attendance violations.",
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

const violationTypeConfig = {
  count: { label: "Violations", color: "var(--chart-1)" },
} satisfies ChartConfig;

const violationOfficeConfig = {
  PH: { label: "PH", color: "var(--chart-1)" },
  CO: { label: "CO", color: "var(--chart-2)" },
} satisfies ChartConfig;

function OnboardingCompletionChart() {
  const hires = useNewHires();
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

function ViolationsByTypeChart() {
  const { data } = useAnalyticsOverviewQuery();
  const rows = Object.entries(data?.byViolationType ?? {}).map(([type, count]) => ({
    type,
    count,
  }));

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

function ViolationsByOfficeChart() {
  const { data } = useAnalyticsOverviewQuery();
  const rows = Object.entries(data?.byOffice ?? {}).map(([office, count]) => ({
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Hiring, onboarding progress and attendance analysis across TGO delivery hubs."
      />
      <Tabs defaultValue="workforce">
        <TabsList>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="workforce" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <MonthlyHiringTrendChart employees={employees} />
            <HeadcountGrowthChart employees={employees} />
            <DepartmentDistributionChart employees={employees} />
            <TenureDistributionChart employees={employees} />
            <OfficeDistributionChart employees={employees} />
            <StatusDistributionChart employees={employees} />
          </div>
          <HeadcountTrendChart employees={employees} />
        </TabsContent>

        <TabsContent value="onboarding" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <OnboardingCompletionChart />
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ViolationsByTypeChart />
            <ViolationsByOfficeChart />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
