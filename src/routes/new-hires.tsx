import { createFileRoute } from "@tanstack/react-router";
import { Building2, Globe2, UserCheck, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { NewHireDialog } from "@/components/new-hire-dialog";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, metrics, tenure } from "@/data/employees";
import { useEmployees } from "@/data/employee-store";

export const Route = createFileRoute("/new-hires")({
  head: () => ({
    meta: [
      { title: "New Hires — TGO Workforce" },
      {
        name: "description",
        content: "Employees who joined TGO in the last twelve months, with onboarding details.",
      },
      { property: "og:title", content: "New Hires — TGO Workforce" },
      {
        property: "og:description",
        content: "Track recent TGO hires by hub, department and start date.",
      },
    ],
  }),
  component: NewHiresPage,
});

function NewHiresPage() {
  const employees = useEmployees();
  const list = metrics(employees).newHireList;
  const active = list.filter((e) => e.status === "Active").length;
  const eastwood = list.filter((e) => e.office === "PH Eastwood").length;
  const medellin = list.filter((e) => e.office === "CO Medellin").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Hires"
        description="Everyone who joined in the last twelve months."
        action={<NewHireDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="New Hires"
          value={list.length}
          hint="Joined in last 12 months"
          icon={UserPlus}
        />
        <MetricCard title="Still Active" value={active} hint="Currently employed" icon={UserCheck} />
        <MetricCard
          title="PH Eastwood"
          value={eastwood}
          hint="Manila delivery hub"
          icon={Building2}
        />
        <MetricCard
          title="CO Medellin"
          value={medellin}
          hint="LATAM delivery hub"
          icon={Globe2}
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.id}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.office}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.position}</TableCell>
                  <TableCell>{formatDate(e.startDate)}</TableCell>
                  <TableCell>{tenure(e.startDate, e.exitDate)}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === "Active" ? "default" : "secondary"}>
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
