import { createFileRoute } from "@tanstack/react-router";
import { Users, UserCheck, UserMinus, UserX } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { EmployeeTable } from "@/components/employee-table";
import { MetricCard } from "@/components/metric-card";
import { employees, statusDistribution } from "@/data/employees";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "Employee Directory — TGO Workforce" },
      {
        name: "description",
        content:
          "Search, filter and export the TGO employee directory by office, department and status.",
      },
      { property: "og:title", content: "Employee Directory — TGO Workforce" },
      {
        property: "og:description",
        content: "Interactive workforce directory with filters, sorting and exports.",
      },
    ],
  }),
  component: DirectoryPage,
});

function DirectoryPage() {
  const byStatus = Object.fromEntries(statusDistribution().map((s) => [s.status, s.count]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory"
        description="Complete roster across all hubs with filtering, sorting and exports."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Employees"
          value={employees.length}
          hint="Across all hubs"
          icon={Users}
        />
        <MetricCard
          title="Active"
          value={byStatus.Active ?? 0}
          hint="Currently employed"
          icon={UserCheck}
        />
        <MetricCard
          title="Resigned"
          value={byStatus.Resigned ?? 0}
          hint="Voluntary departures"
          icon={UserMinus}
        />
        <MetricCard
          title="Terminated"
          value={byStatus.Terminated ?? 0}
          hint="Involuntary departures"
          icon={UserX}
        />
      </div>

      <EmployeeTable />
    </div>
  );
}
