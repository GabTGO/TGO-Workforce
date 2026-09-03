import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell";
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

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Workforce Analytics — TGO Workforce" },
      {
        name: "description",
        content:
          "Charts covering hiring trend, headcount growth, department, tenure, office and status distribution.",
      },
      { property: "og:title", content: "Workforce Analytics — TGO Workforce" },
      {
        property: "og:description",
        content: "Visual breakdown of TGO headcount by hub, department, tenure and month.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const employees = useEmployees();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Hiring, growth, distribution and tenure analysis across TGO delivery hubs."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyHiringTrendChart employees={employees} />
        <HeadcountGrowthChart employees={employees} />
        <DepartmentDistributionChart employees={employees} />
        <TenureDistributionChart employees={employees} />
        <OfficeDistributionChart employees={employees} />
        <StatusDistributionChart employees={employees} />
      </div>
      <HeadcountTrendChart employees={employees} />
    </div>
  );
}
