import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell";
import { EmployeeTable } from "@/components/employee-table";

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
  return (
    <div>
      <PageHeader
        title="Employee Directory"
        description="Complete roster across all hubs with filtering, sorting and exports."
      />
      <EmployeeTable />
    </div>
  );
}
