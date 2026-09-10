import { useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Employee, EmployeeStatus } from "@/data/employees";
import { STATUSES } from "@/data/employees";
import { useEmployeesQuery, useImportEmployees } from "@/data/employee-store";

// Recognized column headers, matched case-insensitively with spaces/underscores stripped —
// so "Employee ID", "employee_id" and "EmployeeID" all map to the same field. This is the
// "analysis" step: whatever columns a given spreadsheet actually has (a plain employee
// export, an onboarding tracker, a recruiter's hire sheet, ...), we pull out whichever of
// these fields it contains and quietly ignore everything else — no fixed template required.
const HEADER_ALIASES: Record<string, keyof Employee> = {
  employeeid: "id",
  id: "id",
  fullname: "name",
  name: "name",
  employeename: "name",
  office: "office",
  officelocation: "office",
  department: "department",
  dept: "department",
  position: "position",
  role: "position",
  jobtitle: "position",
  title: "position",
  startdate: "startDate",
  datestarted: "startDate",
  hiredate: "startDate",
  birthday: "birthday",
  dateofbirth: "birthday",
  dob: "birthday",
  status: "status",
  exitdate: "exitDate",
  dateresigned: "exitDate",
  resignedterminationdate: "exitDate",
  jobofferdate: "jobOfferDate",
  offerdate: "jobOfferDate",
  sourcetype: "sourceType",
  source: "sourceType",
};

function normalizeHeader(header: string): keyof Employee | null {
  const key = header
    .trim()
    .toLowerCase()
    .replace(/[\s_/()-]/g, "");
  return HEADER_ALIASES[key] ?? null;
}

function normalizeDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : value.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return String(value).trim();
}

// Status is the one field the backend validates strictly (it's a real enum, not free
// text) — a source sheet that uses "Status" for something else entirely (an onboarding
// tracker's "Complete", say, rather than an employment status) would otherwise fail the
// whole import. Only carry the value over when it actually matches Active/Resigned/
// Terminated; anything else is left for the reviewer to set explicitly.
function normalizeStatus(value: unknown): EmployeeStatus | undefined {
  if (value == null || value === "") return undefined;
  const raw = String(value).trim().toLowerCase();
  return STATUSES.find((s) => s.toLowerCase() === raw);
}

// One parsed row, plus a stable key for React and for the review table's selection state —
// independent of the (possibly blank, possibly edited) Employee ID so a row stays
// addressable even before it has one.
type ReviewRow = Partial<Employee> & { key: string };

// A row moved to the "already in your directory" panel additionally carries
// which existing employee it matched, purely for display — stripped again
// before the row is ever added back to the importable list (see
// "Add anyway" below), since the import payload has no use for it.
type DuplicateRow = ReviewRow & { matchedId: string; matchedName: string };

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// The "cross import" comparison this dialog exists for: a row exported from
// the old system rarely shares a real foreign key with this database, so the
// best available signal is an exact Employee ID match (when the sheet has
// one) or, failing that, an exact full-name match against the current
// directory. Good enough to separate "already here" from "genuinely new" for
// a human to review — not a fuzzy/typo-tolerant match, since a false
// duplicate silently hides someone who should have been added.
function findExistingMatch(row: ReviewRow, employees: Employee[]): Employee | null {
  const rowId = (row.id ?? "").trim().toLowerCase();
  if (rowId) {
    const byId = employees.find((e) => e.id.trim().toLowerCase() === rowId);
    if (byId) return byId;
  }
  const rowName = normalizeName(row.name ?? "");
  if (!rowName) return null;
  return employees.find((e) => normalizeName(e.name) === rowName) ?? null;
}

let rowKeySeq = 0;
function nextRowKey(): string {
  rowKeySeq += 1;
  return `row-${rowKeySeq}-${Date.now()}`;
}

function blankRow(): ReviewRow {
  return {
    key: nextRowKey(),
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
  };
}

async function parseWorkbook(file: File): Promise<ReviewRow[]> {
  // Dynamically imported so the ~1MB parser only loads when someone actually opens this dialog.
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map((row) => {
    const employee: ReviewRow = { key: nextRowKey(), name: "" };
    for (const [header, value] of Object.entries(row)) {
      const field = normalizeHeader(header);
      if (!field || value === "") continue;
      if (
        field === "startDate" ||
        field === "birthday" ||
        field === "exitDate" ||
        field === "jobOfferDate"
      ) {
        const date = normalizeDate(value);
        if (date) employee[field] = date;
      } else if (field === "status") {
        const status = normalizeStatus(value);
        if (status) employee.status = status;
      } else {
        employee[field] = String(value).trim();
      }
    }
    return employee;
  });
}

type Step = "select" | "review";

export function ImportEmployeesDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<DuplicateRow[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Loading (not just an empty result) matters here: this list is what the
  // scan compares against, so a query that's still in flight must never be
  // read as "the directory is empty" — that would silently let real
  // duplicates through as if the database had nothing in it yet.
  const { data: employeesData, isLoading: employeesLoading } = useEmployeesQuery();
  const employees = employeesData ?? [];
  const importMutation = useImportEmployees();

  function reset() {
    setStep("select");
    setScanning(false);
    setImporting(false);
    setFile(null);
    setRows([]);
    setDuplicateRows([]);
    setShowDuplicates(false);
    setSelected(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleScan() {
    if (!file) return;
    setScanning(true);
    try {
      const parsed = await parseWorkbook(file);
      if (parsed.length === 0) {
        toast.error("No rows found in that file.");
        return;
      }
      // The cross-import comparison: split the scanned rows into ones that
      // already match someone in the current directory and ones that don't,
      // so the review table defaults to showing only who's actually new.
      const newRows: ReviewRow[] = [];
      const existingRows: DuplicateRow[] = [];
      for (const row of parsed) {
        const match = findExistingMatch(row, employees);
        if (match) existingRows.push({ ...row, matchedId: match.id, matchedName: match.name });
        else newRows.push(row);
      }
      setRows(newRows);
      setDuplicateRows(existingRows);
      setShowDuplicates(false);
      setSelected(new Set());
      setStep("review");
    } catch (error) {
      console.error(error);
      toast.error(
        "Couldn't read that file. Make sure it's a valid .xlsx, .xls or .csv file.",
      );
    } finally {
      setScanning(false);
    }
  }

  // Pulls a row out of the "already in your directory" panel and into the
  // editable/importable table below — for the rare case the name match was
  // a false positive (two different people who happen to share a name).
  function addDuplicateAnyway(key: string) {
    setDuplicateRows((prev) => {
      const found = prev.find((r) => r.key === key);
      if (!found) return prev;
      const { matchedId: _matchedId, matchedName: _matchedName, ...clean } = found;
      setRows((rs) => [...rs, clean]);
      return prev.filter((r) => r.key !== key);
    });
  }

  function setRowField(
    key: string,
    field:
      | "id"
      | "name"
      | "office"
      | "department"
      | "position"
      | "jobOfferDate"
      | "startDate"
      | "exitDate"
      | "birthday"
      | "sourceType",
    value: string,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function setRowStatus(key: string, status: EmployeeStatus | "unset") {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        if (status === "unset") {
          const { status: _drop, ...rest } = r;
          return rest as ReviewRow;
        }
        return { ...r, status };
      }),
    );
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setSelected((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function toggleRow(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.key)) : new Set());
  }

  function deleteSelected() {
    const count = selected.size;
    setRows((prev) => prev.filter((r) => !selected.has(r.key)));
    setSelected(new Set());
    toast.success(
      `Removed ${count} row${count === 1 ? "" : "s"} from the import`,
    );
  }

  async function handleImport() {
    setImporting(true);
    try {
      const payload = rows.map(({ key: _key, ...rest }) => rest);
      const { added, skipped } = await importMutation.mutateAsync(payload);

      if (added === 0) {
        toast.error("No usable rows to import. Make sure each row has a name.");
      } else {
        toast.success(
          `Imported ${added} employee${added === 1 ? "" : "s"}${
            skipped > 0
              ? ` (${skipped} row${skipped === 1 ? "" : "s"} skipped — missing a name)`
              : ""
          }`,
        );
        setOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.key));
  const someSelected = rows.some((r) => selected.has(r.key));
  const usableCount = rows.filter((r) => (r.name ?? "").trim()).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" /> Import from Excel
        </Button>
      </DialogTrigger>

      {step === "select" ? (
        <DialogContent className="sm:max-w-md">
          {scanning ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Scanning file...</p>
                <p className="text-sm text-muted-foreground">
                  Reading {file?.name}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="pb-1">
                <h2 className="text-base font-semibold">Import from Excel</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a .xlsx, .xls or .csv file — an export from another
                  system works fine. We'll scan it, match its columns to
                  employee fields, and cross-check every row against your
                  current directory (by Employee ID, or by name when there's
                  no ID column) so rows that already exist here are called out
                  separately from ones that look genuinely new.
                </p>
              </div>

              <div className="space-y-3 py-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-accent"
                >
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click to choose a file, or drag one here
                    </p>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Recognized columns: Employee ID, Full Name, Office,
                  Department, Position (or Role), Start Date, Birthday, Status,
                  Date Resigned, Job Offer Date. Only Full Name is required —
                  any other columns in the file (onboarding checklists,
                  recruiter notes, and so on) are simply ignored.
                </p>
              </div>

              {employeesLoading && (
                <p className="text-xs text-muted-foreground">
                  Loading your current directory to compare against…
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleScan} disabled={!file || employeesLoading}>
                  Scan File
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      ) : (
        <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden p-0 sm:max-w-6xl">
          {importing ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Importing employees...</p>
                <p className="text-sm text-muted-foreground">
                  Adding {usableCount} record{usableCount === 1 ? "" : "s"} to
                  the directory
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 border-b px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Review import</h2>
                    <p className="text-sm text-muted-foreground">
                      Found {rows.length + duplicateRows.length} row
                      {rows.length + duplicateRows.length === 1 ? "" : "s"} in{" "}
                      {file?.name}.{" "}
                      {duplicateRows.length > 0
                        ? `${duplicateRows.length} already ${duplicateRows.length === 1 ? "matches" : "match"} someone in your directory (hidden below, by default) — ${rows.length} look new.`
                        : "None of them matched your existing directory — all look new."}{" "}
                      Edit, delete or add rows below — nothing is saved until
                      you import.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("select");
                      setRows([]);
                      setDuplicateRows([]);
                      setSelected(new Set());
                    }}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                </div>

                {duplicateRows.length > 0 && (
                  <div className="rounded-md border">
                    <button
                      type="button"
                      onClick={() => setShowDuplicates((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        {duplicateRows.length} already in your directory — skipped by default
                      </span>
                      {showDuplicates ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {showDuplicates && (
                      <div className="max-h-48 overflow-auto border-t">
                        <Table>
                          <TableBody>
                            {duplicateRows.map((r) => (
                              <TableRow key={r.key}>
                                <TableCell className="text-sm">
                                  <p className="font-medium">{r.name || "(no name)"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Matches existing {r.matchedId} · {r.matchedName}
                                  </p>
                                </TableCell>
                                <TableCell className="w-40 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addDuplicateAnyway(r.key)}
                                  >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add anyway
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}

                {someSelected && (
                  <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5">
                    <p className="text-sm font-medium">
                      {selected.size} row{selected.size === 1 ? "" : "s"}{" "}
                      selected
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelected}
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
              </div>

              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            allSelected
                              ? true
                              : someSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) =>
                            toggleAll(checked === true)
                          }
                          aria-label="Select all rows"
                        />
                      </TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Job Offer Date</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Exit Date</TableHead>
                      <TableHead>Birthday</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={13}
                          className="h-24 text-center text-muted-foreground"
                        >
                          {duplicateRows.length > 0
                            ? "Everyone in this file already matched someone in your directory. Add one below, expand the panel above to add a match anyway, or go back and pick a different file."
                            : "No rows left. Add one below or go back and pick a different file."}
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((r) => {
                      const missingName = !(r.name ?? "").trim();
                      return (
                        <TableRow
                          key={r.key}
                          data-state={
                            selected.has(r.key) ? "selected" : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selected.has(r.key)}
                              onCheckedChange={(checked) =>
                                toggleRow(r.key, checked === true)
                              }
                              aria-label={`Select row ${r.name || r.key}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.id ?? ""}
                              maxLength={20}
                              placeholder="Auto"
                              className="h-8 w-24 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "id", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.name ?? ""}
                              placeholder="Required"
                              className={`h-8 w-36 text-xs ${missingName ? "border-destructive" : ""}`}
                              onChange={(e) =>
                                setRowField(r.key, "name", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.office ?? ""}
                              placeholder="PH Eastwood"
                              className="h-8 w-32 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "office", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.department ?? ""}
                              className="h-8 w-32 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "department", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.position ?? ""}
                              className="h-8 w-36 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "position", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={r.jobOfferDate ?? ""}
                              className="h-8 w-36 text-xs"
                              onChange={(e) =>
                                setRowField(
                                  r.key,
                                  "jobOfferDate",
                                  e.target.value,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={r.startDate ?? ""}
                              className="h-8 w-36 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "startDate", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={r.status ?? "unset"}
                              onValueChange={(v) =>
                                setRowStatus(
                                  r.key,
                                  v as EmployeeStatus | "unset",
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-28 text-xs">
                                <SelectValue placeholder="Active" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unset">
                                  Active (default)
                                </SelectItem>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={r.exitDate ?? ""}
                              className="h-8 w-36 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "exitDate", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={r.birthday ?? ""}
                              className="h-8 w-36 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "birthday", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.sourceType ?? ""}
                              className="h-8 w-28 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "sourceType", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeRow(r.key)}
                              aria-label={`Remove row ${r.name || r.key}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t px-6 py-3">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={addRow}>
                    <Plus className="mr-2 h-4 w-4" /> Add Row
                  </Button>
                  {rows.length > usableCount && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {rows.length - usableCount} row
                      {rows.length - usableCount === 1 ? "" : "s"} missing a
                      name will be skipped
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleImport} disabled={usableCount === 0}>
                    Import {usableCount || ""} Employee
                    {usableCount === 1 ? "" : "s"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
