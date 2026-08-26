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
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Hiring, growth, distribution and tenure analysis across TGO delivery hubs."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyHiringTrendChart />
        <HeadcountGrowthChart />
        <DepartmentDistributionChart />
        <TenureDistributionChart />
        <OfficeDistributionChart />
        <StatusDistributionChart />
      </div>
      <HeadcountTrendChart />
    </div>
  );
}
