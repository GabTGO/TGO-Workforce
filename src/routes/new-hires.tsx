import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell";
import { NewHireDialog } from "@/components/new-hire-dialog";
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
  const list = metrics().newHireList;
  return (
    <div>
      <PageHeader
        title="New Hires"
        description="Everyone who joined in the last twelve months."
        action={<NewHireDialog />}
      />
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
