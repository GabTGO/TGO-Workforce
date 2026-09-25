// The detail view behind a clickable Dashboard metric card (see
// src/routes/index.tsx) — a wide, searchable table of exactly the employees
// that card's number counts, with CSV/PDF export scoped to whatever the
// search currently matches. One shared component for every card (Active,
// New Hires, Exits, PH Eastwood, CO Medellin) rather than five bespoke
// modals, since they're all "here's the employee list behind this number."
//
// Status always renders through isInTraining() (same as the Employee
// Directory's table) rather than the raw e.status — for the New Hires card
// in particular this means every row shows "Training" instead of "Active",
// since that card's window (started in the last RECENT_HIRE_DAYS days)
// matches the training-period cutoff exactly.
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmployeeNameLink } from "@/components/employee-name-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, isInTraining, type Employee, type EmployeeStatus } from "@/data/employees";
import { exportEmployeesCsv, exportEmployeesPdf } from "@/lib/export";

const STATUS_VARIANT: Record<EmployeeStatus, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Resigned: "secondary",
  Terminated: "destructive",
};

export function MetricDetailModal({
  open,
  onOpenChange,
  title,
  description,
  employees,
  exportBaseName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  employees: Employee[];
  exportBaseName: string;
}) {
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.office.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q),
    );
  }, [employees, query]);

  async function handleExport(format: "csv" | "pdf") {
    if (filtered.length === 0) {
      toast.error("No employees to export.");
      return;
    }
    setExporting(true);
    try {
      if (format === "csv") exportEmployeesCsv(filtered, exportBaseName);
      else await exportEmployeesPdf(filtered, exportBaseName);
      toast.success(
        `Exported ${filtered.length} employee${filtered.length === 1 ? "" : "s"} as ${format.toUpperCase()}`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID, office, department or position..."
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={exporting} onSelect={() => handleExport("csv")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting} onSelect={() => handleExport("pdf")}>
                <FileText className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Exit Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No employees match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      <EmployeeNameLink employee={e} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{e.office}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.department}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.position}</TableCell>
                    <TableCell>
                      {isInTraining(e) ? (
                        <Badge
                          variant="outline"
                          className="border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        >
                          Training
                        </Badge>
                      ) : (
                        <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.startDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.exitDate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {employees.length} employee
          {employees.length === 1 ? "" : "s"}.
        </p>
      </DialogContent>
    </Dialog>
  );
}
