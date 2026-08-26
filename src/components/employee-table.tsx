import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { NewHireDialog } from "@/components/new-hire-dialog";
import {
  DEPARTMENTS,
  OFFICES,
  STATUSES,
  employees,
  formatDate,
  tenure,
  type Employee,
  type EmployeeStatus,
} from "@/data/employees";

type SortKey = "id" | "name" | "office" | "department" | "position" | "startDate" | "status";

const statusVariant: Record<EmployeeStatus, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Resigned: "secondary",
  Terminated: "destructive",
};

const PAGE_SIZE = 8;

export function EmployeeTable() {
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("all");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);

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
  }, [query, office, status, department, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  };

  const SortButton = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
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

        <FilterSelect value={office} onChange={(v) => { setOffice(v); setPage(1); }} placeholder="Office" allLabel="All offices" options={[...OFFICES]} />
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="Status" allLabel="All statuses" options={[...STATUSES]} />
        <FilterSelect value={department} onChange={(v) => { setDepartment(v); setPage(1); }} placeholder="Department" allLabel="All departments" options={[...DEPARTMENTS]} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => toast.info("Manage Employees workspace")}>
          <Users className="mr-2 h-4 w-4" /> Manage Employees
        </Button>
        <NewHireDialog />
        <Button variant="outline" size="sm" onClick={() => toast.info("Bulk upload template ready")}>
          <Upload className="mr-2 h-4 w-4" /> Bulk Upload
        </Button>
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortButton label="Employee ID" sortKey="id" /></TableHead>
                  <TableHead><SortButton label="Full Name" sortKey="name" /></TableHead>
                  <TableHead><SortButton label="Office" sortKey="office" /></TableHead>
                  <TableHead><SortButton label="Department" sortKey="department" /></TableHead>
                  <TableHead><SortButton label="Position" sortKey="position" /></TableHead>
                  <TableHead><SortButton label="Start Date" sortKey="startDate" /></TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead><SortButton label="Status" sortKey="status" /></TableHead>
                  <TableHead>Exit Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No employees match the current filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{e.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.office}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.department}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.position}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.startDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{tenure(e.startDate, e.exitDate)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[e.status]}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.exitDate)}</TableCell>
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
