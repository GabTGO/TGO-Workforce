import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell";
import { EmployeeTable } from "@/components/employee-table";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "Employee Directory — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content:
          "Search, filter and export the TGO employee directory by office, department and status.",
      },
      {
        property: "og:title",
        content: "Employee Directory — Torero Global Outsourcing HR Operations",
      },
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
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory"
        description="Complete roster across all hubs with filtering, sorting and exports."
      />

      <EmployeeTable />
    </div>
  );
}
