// "Bulk Fix" — Super Admin-only tool for closing gaps in the Employee
// Directory's data, two ways:
//
//   1. Scan the directory itself for blank Department/Position/Level/
//      Birthday fields and fill them in on the spot.
//   2. Upload a spreadsheet (same matching approach as
//      @/components/import-employees-dialog.tsx: exact Employee ID, or
//      exact full-name, match against the current directory) and, per
//      matched employee and field, offer to add a value the directory is
//      missing or overwrite one that disagrees with the file.
//
// Both flows follow the same shape: scan -> review -> pick what to apply ->
// confirm with the manage password (see @/lib/manage-password) -> PATCH each
// changed employee via the existing single-employee update endpoint — there's
// no dedicated backend route for this, it's just useUpdateEmployee called in
// a loop, the same way import-employees-dialog's "Fix status" action already
// works for a single field.
//
// The button itself is only rendered for a Super Admin (see EmployeeTable) —
// same "UI-level nicety, not the real boundary" caveat as every other
// permission check in this app: the PATCH it drives underneath still only
// requires employees.manage, enforced by the backend regardless of who can
// see this button.

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  FileSpreadsheet,
  Info,
  Sparkles,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Checkbox } from "@/components/ui/checkbox";
import { CreatableComboboxField } from "@/components/creatable-combobox-field";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingPulse } from "@/components/loading-pulse";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Employee } from "@/data/employees";
import { useEmployeesQuery, useUpdateEmployee } from "@/data/employee-store";
import type { ListKey } from "@/data/list-options-api";
import { useListOptionsQuery } from "@/data/list-options-store";
import { MANAGE_PASSWORD } from "@/lib/manage-password";

// The four fields this tool knows how to fill — the ones on Employee that
// realistically end up blank on an otherwise-real record (department,
// position and level are free text with admin-managed presets; birthday is
// explicitly optional). Deliberately excludes name/office/startDate/status:
// those are either always set at creation or sensitive enough that changing
// them belongs in the full Edit Employee form, not a bulk-fill tool.
type FixField = "department" | "position" | "level" | "birthday";

const FIX_FIELDS: { key: FixField; label: string; listKey?: ListKey }[] = [
  { key: "department", label: "Department", listKey: "departments" },
  { key: "position", label: "Position", listKey: "positions" },
  { key: "level", label: "Level", listKey: "levels" },
  { key: "birthday", label: "Birthday" },
];

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim();
}

// --- Mode 2 (Excel) parsing helpers -------------------------------------
// A narrower copy of import-employees-dialog.tsx's HEADER_ALIASES/
// normalizeHeader/normalizeDate/findExistingMatch — limited to the columns
// this tool cares about (id/name to match, the four FIX_FIELDS to diff).
// Kept local rather than shared since the two dialogs' row shapes diverge
// (this one never creates new employees, so it has no use for start date,
// status, etc.), and this tool's matching has to stay in lockstep with its
// own diff logic below.

const HEADER_ALIASES: Record<string, "id" | "name" | FixField> = {
  employeeid: "id",
  id: "id",
  fullname: "name",
  name: "name",
  employeename: "name",
  department: "department",
  dept: "department",
  position: "position",
  role: "position",
  jobtitle: "position",
  title: "position",
  level: "level",
  careerlevel: "level",
  birthday: "birthday",
  dateofbirth: "birthday",
  dob: "birthday",
};

function normalizeHeader(header: string): "id" | "name" | FixField | null {
  const key = header
    .trim()
    .toLowerCase()
    .replace(/[\s_/()-]/g, "");
  return HEADER_ALIASES[key] ?? null;
}

function normalizeDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function findExistingMatch(
  row: { id?: string; name?: string },
  employees: Employee[],
): Employee | null {
  const rowId = (row.id ?? "").trim().toLowerCase();
  if (rowId) {
    const byId = employees.find((e) => e.id.trim().toLowerCase() === rowId);
    if (byId) return byId;
  }
  const rowName = normalizeName(row.name ?? "");
  if (!rowName) return null;
  return employees.find((e) => normalizeName(e.name) === rowName) ?? null;
}

type ParsedRow = Partial<Record<"id" | "name" | FixField, string>>;

async function parseWorkbook(file: File): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows.map((row) => {
    const parsed: ParsedRow = {};
    for (const [header, value] of Object.entries(row)) {
      const field = normalizeHeader(header);
      if (!field || value === "") continue;
      if (field === "birthday") {
        const date = normalizeDate(value);
        if (date) parsed[field] = date;
      } else {
        parsed[field] = String(value).trim();
      }
    }
    return parsed;
  });
}

type ExcelDiff = {
  field: FixField;
  label: string;
  dbValue: string;
  fileValue: string;
  kind: "add" | "conflict";
};

type MatchRow = {
  key: string;
  employee: Employee;
  diffs: ExcelDiff[];
  // Which of this row's diffs are currently checked to be applied on
  // confirm — "add" diffs start checked (purely additive, low-risk);
  // "conflict" diffs start unchecked (the file's value replacing something
  // already on file needs an explicit opt-in, per the overwrite-or-disregard
  // choice this tool exists to offer).
  applied: Set<FixField>;
};

export function BulkFixDialog() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"gaps" | "excel">("gaps");

  const { data: employeesData, isLoading: employeesLoading } = useEmployeesQuery();
  const employees = useMemo(() => employeesData ?? [], [employeesData]);
  const { data: listOptions } = useListOptionsQuery();
  const updateEmployeeMutation = useUpdateEmployee();

  // --- Mode 1: scan the directory itself for blank fields ---------------
  const [gapScanned, setGapScanned] = useState(false);
  const [gapScanning, setGapScanning] = useState(false);
  const [gapEdits, setGapEdits] = useState<Record<string, Partial<Record<FixField, string>>>>({});

  // The scan itself just filters data that's already loaded — near
  // instant — but a brief, deliberate "scanning" beat here (same animation
  // as the Excel scan below) makes clear a real pass over the directory
  // happened, rather than the results panel just appearing.
  async function handleScanGaps() {
    setGapScanning(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setGapScanning(false);
    setGapScanned(true);
  }

  const gapEmployees = useMemo(
    () => employees.filter((e) => FIX_FIELDS.some((f) => isBlank(e[f.key]))),
    [employees],
  );

  const gapEditCount = useMemo(
    () =>
      Object.values(gapEdits).reduce(
        (sum, fields) => sum + Object.values(fields).filter((v) => v && v.trim()).length,
        0,
      ),
    [gapEdits],
  );

  function setGapEdit(employeeId: string, field: FixField, value: string) {
    setGapEdits((prev) => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], [field]: value },
    }));
  }

  async function applyGapFixes(): Promise<number> {
    let applied = 0;
    for (const [employeeId, fields] of Object.entries(gapEdits)) {
      const employee = employees.find((e) => e.id === employeeId);
      if (!employee) continue;
      const patch: Partial<Employee> = {};
      for (const f of FIX_FIELDS) {
        const value = fields[f.key];
        if (value && value.trim()) patch[f.key] = value.trim();
      }
      if (Object.keys(patch).length === 0) continue;
      await updateEmployeeMutation.mutateAsync({
        originalId: employee.id,
        employee: { ...employee, ...patch },
      });
      applied += 1;
    }
    return applied;
  }

  // --- Mode 2: cross-reference an uploaded Excel file --------------------
  const [file, setFile] = useState<File | null>(null);
  const [excelScanning, setExcelScanning] = useState(false);
  const [excelScanned, setExcelScanned] = useState(false);
  const [matchRows, setMatchRows] = useState<MatchRow[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleScanExcel() {
    if (!file) return;
    setExcelScanning(true);
    try {
      const parsedRows = await parseWorkbook(file);
      if (parsedRows.length === 0) {
        toast.error("No rows found in that file.");
        return;
      }
      const seen = new Set<string>();
      const results: MatchRow[] = [];
      let unmatched = 0;
      for (const row of parsedRows) {
        const match = findExistingMatch(row, employees);
        if (!match) {
          unmatched += 1;
          continue;
        }
        if (seen.has(match.id)) continue;
        const diffs: ExcelDiff[] = [];
        for (const f of FIX_FIELDS) {
          const fileValue = row[f.key];
          if (!fileValue) continue;
          const dbValue = match[f.key] ?? "";
          if (isBlank(dbValue)) {
            diffs.push({ field: f.key, label: f.label, dbValue: "", fileValue, kind: "add" });
          } else if (dbValue.trim() !== fileValue.trim()) {
            diffs.push({ field: f.key, label: f.label, dbValue, fileValue, kind: "conflict" });
          }
        }
        if (diffs.length === 0) continue;
        seen.add(match.id);
        results.push({
          key: match.id,
          employee: match,
          diffs,
          applied: new Set(diffs.filter((d) => d.kind === "add").map((d) => d.field)),
        });
      }
      setMatchRows(results);
      setUnmatchedCount(unmatched);
      setExcelScanned(true);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't read that file. Make sure it's a valid .xlsx, .xls or .csv file.");
    } finally {
      setExcelScanning(false);
    }
  }

  function toggleDiffApply(rowKey: string, field: FixField, checked: boolean) {
    setMatchRows((prev) =>
      prev.map((r) => {
        if (r.key !== rowKey) return r;
        const next = new Set(r.applied);
        if (checked) next.add(field);
        else next.delete(field);
        return { ...r, applied: next };
      }),
    );
  }

  const excelApplyCount = useMemo(
    () => matchRows.reduce((sum, r) => sum + r.applied.size, 0),
    [matchRows],
  );

  async function applyExcelFixes(): Promise<number> {
    let applied = 0;
    for (const row of matchRows) {
      if (row.applied.size === 0) continue;
      const patch: Partial<Employee> = {};
      for (const diff of row.diffs) {
        if (row.applied.has(diff.field)) patch[diff.field] = diff.fileValue;
      }
      if (Object.keys(patch).length === 0) continue;
      await updateEmployeeMutation.mutateAsync({
        originalId: row.employee.id,
        employee: { ...row.employee, ...patch },
      });
      applied += 1;
    }
    return applied;
  }

  // --- Shared password-gated confirm -------------------------------------
  const pendingCount = activeTab === "gaps" ? gapEditCount : excelApplyCount;
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [savePassword, setSavePassword] = useState("");
  const [savePasswordError, setSavePasswordError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function confirmSave() {
    if (savePassword !== MANAGE_PASSWORD) {
      setSavePasswordError(true);
      return;
    }
    setSaving(true);
    try {
      const applied = activeTab === "gaps" ? await applyGapFixes() : await applyExcelFixes();
      toast.success(`Updated ${applied} employee${applied === 1 ? "" : "s"}`);
      if (activeTab === "gaps") {
        setGapEdits({});
      } else {
        // The review table reflects a point-in-time diff — once applied,
        // it's stale (the directory has moved), so send them back to
        // scan again rather than show diffs that no longer hold.
        setMatchRows([]);
        setExcelScanned(false);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
      setConfirmingSave(false);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't save some of those changes. Please try again.");
    } finally {
      setSaving(false);
      setSavePassword("");
      setSavePasswordError(false);
    }
  }

  function resetAll() {
    setActiveTab("gaps");
    setGapScanned(false);
    setGapEdits({});
    setFile(null);
    setExcelScanning(false);
    setExcelScanned(false);
    setMatchRows([]);
    setUnmatchedCount(0);
    setConfirmingSave(false);
    setSavePassword("");
    setSavePasswordError(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetAll();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Wrench className="mr-2 h-4 w-4" /> Bulk Fix
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden p-0 sm:max-w-5xl">
          <div className="space-y-3 border-b px-6 py-4">
            <div>
              <h2 className="text-base font-semibold">Bulk Fix</h2>
              <p className="text-sm text-muted-foreground">
                Close gaps in the Employee Directory — Super Admin only.
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Quick guide</AlertTitle>
              <AlertDescription>
                <strong>Scan Directory</strong> finds employees missing a Department, Position,
                Level or Birthday and lets you fill them in directly.{" "}
                <strong>Fill from Excel</strong> matches an uploaded file to existing employees by
                Employee ID or name, then per field offers to add whatever's missing or, if the file
                disagrees with what's on file, lets you choose to overwrite or leave it alone.
                Nothing is saved until you review the results and confirm with the manage password.
              </AlertDescription>
            </Alert>

            {employeesLoading && (
              <p className="text-xs text-muted-foreground">Loading your current directory…</p>
            )}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "gaps" | "excel")}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="px-6 pt-3">
              <TabsList>
                <TabsTrigger value="gaps">Scan Directory</TabsTrigger>
                <TabsTrigger value="excel">Fill from Excel</TabsTrigger>
              </TabsList>
            </div>

            {/* --- Mode 1: Scan Directory --- */}
            <TabsContent value="gaps" className="flex flex-1 flex-col overflow-hidden px-6 pb-4">
              {gapScanning ? (
                <div className="flex flex-1 items-center justify-center">
                  <LoadingPulse
                    icon={Sparkles}
                    title="Scanning the directory..."
                    subtitle="Checking every employee for a blank field"
                  />
                </div>
              ) : !gapScanned ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Scan for missing data</p>
                    <p className="text-sm text-muted-foreground">
                      Checks every employee currently in the directory for a blank Department,
                      Position, Level or Birthday.
                    </p>
                  </div>
                  <Button onClick={handleScanGaps} disabled={employeesLoading} className="mt-2">
                    Scan Directory
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {gapEmployees.length === 0
                        ? "Nothing missing — every employee has all four fields set."
                        : `${gapEmployees.length} employee${gapEmployees.length === 1 ? "" : "s"} ${gapEmployees.length === 1 ? "has" : "have"} at least one blank field. Fill in whichever you want to set — nothing is saved until you confirm.`}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setGapScanned(false)}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                  </div>
                  {gapEmployees.length > 0 && (
                    <div className="flex-1 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            {FIX_FIELDS.map((f) => (
                              <TableHead key={f.key}>{f.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gapEmployees.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="align-top">
                                <p className="text-sm font-medium whitespace-nowrap">{e.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{e.id}</p>
                              </TableCell>
                              {FIX_FIELDS.map((f) => {
                                const current = e[f.key];
                                if (!isBlank(current)) {
                                  return (
                                    <TableCell
                                      key={f.key}
                                      className="align-top text-sm text-muted-foreground"
                                    >
                                      {current}
                                    </TableCell>
                                  );
                                }
                                const editValue = gapEdits[e.id]?.[f.key] ?? "";
                                return (
                                  <TableCell key={f.key} className="align-top">
                                    {f.key === "birthday" ? (
                                      <Input
                                        type="date"
                                        value={editValue}
                                        className="h-8 w-36 text-xs"
                                        onChange={(ev) => setGapEdit(e.id, f.key, ev.target.value)}
                                      />
                                    ) : (
                                      <div className="w-44">
                                        <CreatableComboboxField
                                          label={f.label}
                                          listKey={f.listKey!}
                                          options={listOptions?.[f.listKey!] ?? []}
                                          value={editValue}
                                          onChange={(v) => setGapEdit(e.id, f.key, v)}
                                          placeholder={`Set ${f.label.toLowerCase()}`}
                                        />
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* --- Mode 2: Fill from Excel --- */}
            <TabsContent value="excel" className="flex flex-1 flex-col overflow-hidden px-6 pb-4">
              {excelScanning ? (
                <div className="flex flex-1 items-center justify-center">
                  <LoadingPulse
                    icon={FileSpreadsheet}
                    title="Scanning file..."
                    subtitle={file ? `Reading ${file.name}` : undefined}
                  />
                </div>
              ) : !excelScanned ? (
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
                    Matches rows to existing employees by Employee ID (or full name when there's no
                    ID column), then compares Department, Position, Level and Birthday. Employees
                    this file doesn't match at all are skipped — this tool only fixes existing
                    records, it doesn't add new ones (use Import from Excel for that).
                  </p>
                  <div className="flex justify-end">
                    <Button onClick={handleScanExcel} disabled={!file || employeesLoading}>
                      <Upload className="mr-2 h-4 w-4" /> Scan File
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {matchRows.length === 0
                        ? "Nothing to add or fix — every matched employee already agrees with this file."
                        : `${matchRows.length} employee${matchRows.length === 1 ? "" : "s"} ${matchRows.length === 1 ? "has" : "have"} something to add or reconcile.`}{" "}
                      {unmatchedCount > 0 &&
                        `${unmatchedCount} row${unmatchedCount === 1 ? "" : "s"} in the file didn't match anyone and were ignored.`}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExcelScanned(false);
                        setMatchRows([]);
                      }}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                  </div>
                  {matchRows.length > 0 && (
                    <div className="flex-1 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Current</TableHead>
                            <TableHead>From File</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead className="w-16">Apply</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchRows.flatMap((row) =>
                            row.diffs.map((diff) => (
                              <TableRow key={`${row.key}-${diff.field}`}>
                                <TableCell>
                                  <p className="text-sm font-medium whitespace-nowrap">
                                    {row.employee.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {row.employee.id}
                                  </p>
                                </TableCell>
                                <TableCell className="text-sm">{diff.label}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {diff.dbValue || "—"}
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {diff.fileValue}
                                </TableCell>
                                <TableCell>
                                  {diff.kind === "add" ? (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    >
                                      Add
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    >
                                      <AlertTriangle className="mr-1 h-3 w-3" /> Conflict
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Checkbox
                                    checked={row.applied.has(diff.field)}
                                    onCheckedChange={(checked) =>
                                      toggleDiffApply(row.key, diff.field, checked === true)
                                    }
                                    aria-label={`Apply ${diff.label} for ${row.employee.name}`}
                                  />
                                </TableCell>
                              </TableRow>
                            )),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t px-6 py-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setConfirmingSave(true)} disabled={pendingCount === 0}>
              Save {pendingCount || ""} Change{pendingCount === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmingSave}
        onOpenChange={(next) => {
          setConfirmingSave(next);
          if (!next) {
            setSavePassword("");
            setSavePasswordError(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Save {pendingCount} change{pendingCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This updates{" "}
              {activeTab === "gaps" ? "the employees you filled in" : "the checked fields"} in the
              directory. This can't be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="bulk-fix-password">Confirm with password</Label>
            <Input
              id="bulk-fix-password"
              type="password"
              value={savePassword}
              onChange={(e) => {
                setSavePassword(e.target.value);
                setSavePasswordError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && confirmSave()}
              autoFocus
            />
            {savePasswordError && <p className="text-xs text-destructive">Incorrect password.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmSave();
              }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Confirm & Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
