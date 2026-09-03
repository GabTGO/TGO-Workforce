import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportEmployeesDialog } from "@/components/import-employees-dialog";
import { ManageEmployeesDialog } from "@/components/manage-employees-dialog";
import { NewHireDialog } from "@/components/new-hire-dialog";
import { useBulkDeleteEmployees, useEmployees } from "@/data/employee-store";
import {
  DEPARTMENTS,
  OFFICES,
  STATUSES,
  formatDate,
  tenure,
  type Employee,
  type EmployeeStatus,
} from "@/data/employees";

type SortKey =
  "id" | "name" | "office" | "department" | "position" | "startDate" | "status";

const statusVariant: Record<
  EmployeeStatus,
  "default" | "secondary" | "destructive"
> = {
  Active: "default",
  Resigned: "secondary",
  Terminated: "destructive",
};

const PAGE_SIZE = 8;

export function EmployeeTable() {
  const employees = useEmployees();
  const bulkDeleteMutation = useBulkDeleteEmployees();
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("all");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  // Filters, sort, employees (create/delete/import/edit) and even a manual
  // refetch (the 15s realtime poll) all need to recompute this — leaving any
  // of them out of the dependency array is exactly what caused the table to
  // show stale rows until an unrelated filter click forced a re-render.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = employees.filter((e) => {
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
    return [...rows].sort((a, b) => {
      const av = String(a[sort.key as keyof Employee] ?? "");
      const bv = String(b[sort.key as keyof Employee] ?? "");
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [employees, query, office, status, department, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Drop any selected id that no longer exists (deleted elsewhere, or by
  // this same bulk action) so the "N selected" count and the header
  // checkbox's indeterminate state never drift from reality.
  useEffect(() => {
    setSelected((prev) => {
      const validIds = new Set(employees.map((e) => e.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [employees]);

  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  };

  const allOnPageSelected =
    rows.length > 0 && rows.every((e) => selected.has(e.id));
  const someOnPageSelected = rows.some((e) => selected.has(e.id));

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of rows) {
        if (checked) next.add(e.id);
        else next.delete(e.id);
      }
      return next;
    });
  }

  async function confirmBulkDelete() {
    const ids = [...selected];
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      toast.success(
        `Removed ${result.deleted} employee${result.deleted === 1 ? "" : "s"}`,
      );
      if (result.notFound.length > 0) {
        toast.error(
          `${result.notFound.length} selected row(s) were already removed elsewhere`,
        );
      }
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast.error("Couldn't delete the selected employees. Please try again.");
    } finally {
      setConfirmingBulkDelete(false);
    }
  }

  const SortButton = ({
    label,
    sortKey,
  }: {
    label: string;
    sortKey: SortKey;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortKey)}
      className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap items-center gap-2">
        <ManageEmployeesDialog />
        <NewHireDialog />
        <ImportEmployeesDialog />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export Options
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => toast.success("Exporting CSV")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success("Exporting XLSX")}>
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success("Exporting PDF")}>
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm font-medium">
            {selected.size} employee{selected.size === 1 ? "" : "s"} selected
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmingBulkDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            <X className="mr-2 h-4 w-4" /> Clear selection
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allOnPageSelected
                          ? true
                          : someOnPageSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) =>
                        togglePage(checked === true)
                      }
                      aria-label="Select all rows on this page"
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Employee ID" sortKey="id" />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Full Name" sortKey="name" />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Office" sortKey="office" />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Department" sortKey="department" />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Position" sortKey="position" />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Start Date" sortKey="startDate" />
                  </TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>
                    <SortButton label="Status" sortKey="status" />
                  </TableHead>
                  <TableHead>Exit Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No employees match the current filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((e) => (
                  <TableRow
                    key={e.id}
                    data-state={selected.has(e.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={(checked) =>
                          toggleRow(e.id, checked === true)
                        }
                        aria-label={`Select ${e.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {e.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {e.office}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {e.department}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {e.position}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(e.startDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {tenure(e.startDate, e.exitDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[e.status]}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(e.exitDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Showing {rows.length} of {filtered.length} employees
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

      <AlertDialog
        open={confirmingBulkDelete}
        onOpenChange={setConfirmingBulkDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>
              Delete {selected.size} employee{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {selected.size} record
              {selected.size === 1 ? "" : "s"} from the directory. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending
                ? "Deleting..."
                : "Confirm & Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allLabel: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
