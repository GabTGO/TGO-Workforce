import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Search,
  UserCheck,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { NewHireDialog } from "@/components/new-hire-dialog";
import { MetricCard } from "@/components/metric-card";
import { FilterSelect } from "@/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEPARTMENTS,
  OFFICES,
  STATUSES,
  formatDate,
  metrics,
  tenure,
  tenureDays,
} from "@/data/employees";
import { useEmployees } from "@/data/employee-store";

export const Route = createFileRoute("/new-hires")({
  head: () => ({
    meta: [
      { title: "New Hires — TGO Workforce" },
      {
        name: "description",
        content:
          "Employees who joined TGO in the last twelve months, with onboarding details.",
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

const PAGE_SIZE = 8;

function NewHiresPage() {
  const employees = useEmployees();
  const list = metrics(employees).newHireList;
  const active = list.filter((e) => e.status === "Active").length;
  const eastwood = list.filter((e) => e.office === "PH Eastwood").length;
  const medellin = list.filter((e) => e.office === "CO Medellin").length;

  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("all");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [page, setPage] = useState(1);

  // Same search + filter shape as the Employee Directory table (see
  // employee-table.tsx) so the two feel like one product, just scoped to the
  // last 12 months of hires here.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q);
      return (
        matchesQuery &&
        (office === "all" || e.office === office) &&
        (status === "all" || e.status === status) &&
        (department === "all" || e.department === department)
      );
    });
  }, [list, query, office, status, department]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // `list` is already newest-first, so a brand-new hire is first in it — the
  // only things that could still bury it are a stale filter or being stuck
  // on a later page, so clear both instead of making someone click back to
  // page 1 and reset filters themselves.
  function handleNewHireCreated() {
    setQuery("");
    setOffice("all");
    setStatus("all");
    setDepartment("all");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Hires"
        description="Everyone who joined in the last twelve months."
        action={<NewHireDialog onCreated={handleNewHireCreated} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="New Hires"
          value={list.length}
          hint="Joined in last 12 months"
          icon={UserPlus}
        />
        <MetricCard
          title="Still Active"
          value={active}
          hint="Currently employed"
          icon={UserCheck}
        />
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, ID or position..."
            className="pl-9"
          />
        </div>

        <FilterSelect
          value={office}
          onChange={(v) => {
            setOffice(v);
            setPage(1);
          }}
          placeholder="Office"
          allLabel="All offices"
          options={[...OFFICES]}
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          placeholder="Status"
          allLabel="All statuses"
          options={[...STATUSES]}
        />
        <FilterSelect
          value={department}
          onChange={(v) => {
            setDepartment(v);
            setPage(1);
          }}
          placeholder="Department"
          allLabel="All departments"
          options={[...DEPARTMENTS]}
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
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No new hires match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.id}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.office}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.position}</TableCell>
                  <TableCell>{formatDate(e.startDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div>{tenure(e.startDate, e.exitDate)}</div>
                    <div className="text-xs text-muted-foreground">
                      {tenureDays(e.startDate, e.exitDate)} days
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={e.status === "Active" ? "default" : "secondary"}
                    >
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Showing {rows.length} of {filtered.length} new hires
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
