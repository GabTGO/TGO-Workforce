// Excel import/export for the onboarding checklist tracker. Mirrors the
// established patterns elsewhere in this codebase rather than porting the
// source onboarding app's excel-import-button.tsx/excel-export-button.tsx
// verbatim: xlsx is dynamically imported (src/lib/export.ts, and
// import-employees-dialog.tsx's parseWorkbook) so its bundle only loads when
// someone actually uses one of these, and import is a two-step
// scan-then-review flow (also import-employees-dialog.tsx) so nothing is
// written until the reviewer confirms.
//
// There's no bulk-import endpoint on the backend for this smaller dataset
// (unlike POST /employees/import) — each usable reviewed row is created with
// its own POST via useCreateNewHire, same mutation the Add dialog uses.

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Upload,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeStatus, type NewHire, type NewHireInput } from "@/data/new-hire-api";
import { useCreateNewHire } from "@/data/new-hire-store";

function timestampedName(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Export ----------------------------------------------------------------
// Column headers mirror the source onboarding app's excel-export-button.tsx
// / excel-import-button.tsx exactly, so a file exported here (or from that
// app) can round-trip through either one without remapping.

function hireToRow(hire: NewHire) {
  return {
    Name: hire.name,
    Role: hire.roleTitle,
    "Start Date": hire.startDate,
    "Recruitment Lead": hire.recruitmentLead,
    "Onboarding Specialist": hire.onboardingSpecialist,
    "1. JO Discussion": hire.joDiscussion ? "Yes" : "No",
    "2. Confirmation Sheet Signed": hire.confirmationSigned ? "Yes" : "No",
    "3. Welcome Email Sent": hire.welcomeEmailSent ? "Yes" : "No",
    "3a. Completed By": hire.completedBy ?? "",
    "4. New Hire Info Completed": hire.newHireInfo ? "Yes" : "No",
    "5. ID Photo Provided": hire.idPhoto ? "Yes" : "No",
    "6. Credentials Created": hire.credentialsCreated ? "Yes" : "No",
    "7. Onboarding Day": hire.onboardingDay ? "Yes" : "No",
    Status: computeStatus(hire),
  };
}

export function OnboardingExportButton({ hires }: { hires: NewHire[] }) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (hires.length === 0) {
      toast.error("No new hires to export.");
      return;
    }
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const rows = hires.map(hireToRow);
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "New Hires");
      const buffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      }) as ArrayBuffer;
      triggerDownload(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        timestampedName("onboarding-new-hires", "xlsx"),
      );
      toast.success(
        `Exported ${hires.length} new hire${hires.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || hires.length === 0}
      onClick={handleExport}
      title={hires.length === 0 ? "Nothing to export" : "Export the rows currently shown to Excel"}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export Excel
    </Button>
  );
}

// --- Import ------------------------------------------------------------

type ImportField = keyof NewHireInput;

// Recognized column headers, matched case-insensitively with spaces,
// underscores, digits and punctuation stripped — so "1. JO Discussion",
// "jo_discussion" and "JODiscussion" all resolve to the same field. Same
// normalization approach as import-employees-dialog.tsx's HEADER_ALIASES.
const HEADER_ALIASES: Record<string, ImportField> = {
  name: "name",
  role: "roleTitle",
  roletitle: "roleTitle",
  jobtitle: "roleTitle",
  startdate: "startDate",
  recruitmentlead: "recruitmentLead",
  onboardingspecialist: "onboardingSpecialist",
  jodiscussion: "joDiscussion",
  confirmationsheetsigned: "confirmationSigned",
  confirmationsigned: "confirmationSigned",
  welcomeemailsent: "welcomeEmailSent",
  newhireinfocompleted: "newHireInfo",
  newhireinfo: "newHireInfo",
  idphotoprovided: "idPhoto",
  idphoto: "idPhoto",
  credentialscreated: "credentialsCreated",
  onboardingday: "onboardingDay",
};

const BOOLEAN_FIELDS = new Set<ImportField>([
  "joDiscussion",
  "confirmationSigned",
  "welcomeEmailSent",
  "newHireInfo",
  "idPhoto",
  "credentialsCreated",
  "onboardingDay",
]);

function normalizeHeader(header: string): ImportField | null {
  const key = header
    .trim()
    .toLowerCase()
    .replace(/[\s_/().0-9-]/g, "");
  return HEADER_ALIASES[key] ?? null;
}

function normalizeBoolean(value: unknown): boolean {
  const raw = String(value).trim().toLowerCase();
  return raw === "yes" || raw === "true" || raw === "1" || raw === "x";
}

// One parsed row, plus a stable key for React and the review table —
// independent of name so a blank row added by hand stays addressable.
type ReviewRow = NewHireInput & { key: string };

let rowKeySeq = 0;
function nextRowKey(): string {
  rowKeySeq += 1;
  return `onboarding-import-${rowKeySeq}-${Date.now()}`;
}

function blankRow(): ReviewRow {
  return { key: nextRowKey(), name: "" };
}

async function parseWorkbook(file: File): Promise<ReviewRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map((row) => {
    const hire: ReviewRow = { key: nextRowKey(), name: "" };
    for (const [header, value] of Object.entries(row)) {
      const field = normalizeHeader(header);
      if (!field || value === "") continue;
      if (BOOLEAN_FIELDS.has(field)) {
        (hire as Record<string, unknown>)[field] = normalizeBoolean(value);
      } else {
        (hire as Record<string, unknown>)[field] = String(value).trim();
      }
    }
    return hire;
  });
}

type Step = "select" | "review";

export function OnboardingImportDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createMutation = useCreateNewHire();

  function reset() {
    setStep("select");
    setScanning(false);
    setImporting(false);
    setFile(null);
    setRows([]);
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
      setRows(parsed);
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

  function setRowField(key: string, field: ImportField, value: string | boolean) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  const usableRows = rows.filter((r) => (r.name ?? "").trim());
  const usableCount = usableRows.length;

  async function handleImport() {
    setImporting(true);
    try {
      let added = 0;
      for (const { key: _key, ...input } of usableRows) {
        await createMutation.mutateAsync(input);
        added += 1;
      }
      const skipped = rows.length - added;
      if (added === 0) {
        toast.error("No usable rows to import. Make sure each row has a name.");
      } else {
        toast.success(
          `Imported ${added} new hire${added === 1 ? "" : "s"}${
            skipped > 0
              ? ` (${skipped} row${skipped === 1 ? "" : "s"} skipped — missing a name)`
              : ""
          }`,
        );
        setOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Import failed partway through. Check the tracker before retrying.");
    } finally {
      setImporting(false);
    }
  }

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
                <p className="text-sm text-muted-foreground">Reading {file?.name}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="pb-1">
                <h2 className="text-base font-semibold">Import from Excel</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a .xlsx, .xls or .csv file. We'll scan it, match its
                  columns to onboarding fields, and show you a preview to
                  edit before anything is added.
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
                  Recognized columns: Name, Role, Start Date, Recruitment
                  Lead, Onboarding Specialist, and the 7 checklist steps
                  (JO Discussion, Confirmation Signed, Welcome Email Sent,
                  New Hire Info, ID Photo, Credentials Created, Onboarding
                  Day). Only Name is required.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleScan} disabled={!file}>
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
                <p className="text-sm font-medium">Importing new hires...</p>
                <p className="text-sm text-muted-foreground">
                  Adding {usableCount} record{usableCount === 1 ? "" : "s"} to
                  the tracker
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1 border-b px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Review import</h2>
                    <p className="text-sm text-muted-foreground">
                      Found {rows.length} row{rows.length === 1 ? "" : "s"} in{" "}
                      {file?.name}. Edit, delete or add rows below — nothing
                      is saved until you import.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("select");
                      setRows([]);
                    }}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Recruitment Lead</TableHead>
                      <TableHead>Onboarding Specialist</TableHead>
                      <TableHead className="text-center">JO</TableHead>
                      <TableHead className="text-center">Confirm</TableHead>
                      <TableHead className="text-center">Welcome</TableHead>
                      <TableHead className="text-center">Info</TableHead>
                      <TableHead className="text-center">Photo</TableHead>
                      <TableHead className="text-center">Creds</TableHead>
                      <TableHead className="text-center">Day</TableHead>
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
                          No rows left. Add one below or go back and pick a
                          different file.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((r) => {
                      const missingName = !(r.name ?? "").trim();
                      return (
                        <TableRow key={r.key}>
                          <TableCell>
                            <Input
                              value={r.name ?? ""}
                              placeholder="Required"
                              className={`h-8 w-36 text-xs ${missingName ? "border-destructive" : ""}`}
                              onChange={(e) => setRowField(r.key, "name", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.roleTitle ?? ""}
                              className="h-8 w-32 text-xs"
                              onChange={(e) => setRowField(r.key, "roleTitle", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.startDate ?? ""}
                              placeholder="Sept 8, 2026 / 9:00 AM"
                              className="h-8 w-40 text-xs"
                              onChange={(e) => setRowField(r.key, "startDate", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.recruitmentLead ?? ""}
                              className="h-8 w-32 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "recruitmentLead", e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.onboardingSpecialist ?? ""}
                              className="h-8 w-36 text-xs"
                              onChange={(e) =>
                                setRowField(r.key, "onboardingSpecialist", e.target.value)
                              }
                            />
                          </TableCell>
                          {(
                            [
                              "joDiscussion",
                              "confirmationSigned",
                              "welcomeEmailSent",
                              "newHireInfo",
                              "idPhoto",
                              "credentialsCreated",
                              "onboardingDay",
                            ] as const
                          ).map((field) => (
                            <TableCell key={field} className="text-center">
                              <Checkbox
                                checked={Boolean(r[field])}
                                onCheckedChange={(checked) =>
                                  setRowField(r.key, field, checked === true)
                                }
                                className="mx-auto"
                              />
                            </TableCell>
                          ))}
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
                    Import {usableCount || ""} New Hire
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
