import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import type { Employee } from "@/data/employees";
import { addEmployees } from "@/data/employee-store";

// Recognized column headers, matched case-insensitively with spaces/underscores stripped —
// so "Employee ID", "employee_id" and "EmployeeID" all map to the same field.
const HEADER_ALIASES: Record<string, keyof Employee> = {
  employeeid: "id",
  id: "id",
  fullname: "name",
  name: "name",
  office: "office",
  officelocation: "office",
  department: "department",
  dept: "department",
  position: "position",
  jobtitle: "position",
  title: "position",
  startdate: "startDate",
  datestarted: "startDate",
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
  const key = header.trim().toLowerCase().replace(/[\s_/()-]/g, "");
  return HEADER_ALIASES[key] ?? null;
}

function normalizeDate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return String(value).trim() || undefined;
}

async function parseWorkbook(file: File): Promise<Partial<Employee>[]> {
  // Dynamically imported so the ~1MB parser only loads when someone actually opens this dialog.
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows.map((row) => {
    const employee: Partial<Employee> = {};
    for (const [header, value] of Object.entries(row)) {
      const field = normalizeHeader(header);
      if (!field || value === "") continue;
      if (field === "startDate" || field === "birthday" || field === "exitDate" || field === "jobOfferDate") {
        (employee as Record<string, unknown>)[field] = normalizeDate(value);
      } else {
        (employee as Record<string, unknown>)[field] = String(value).trim();
      }
    }
    return employee;
  });
}

export function ImportEmployeesDialog() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setFile(null);
    setImporting(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseWorkbook(file);
      const added = addEmployees(rows);
      const skipped = rows.length - added;

      if (added === 0) {
        toast.error("No usable rows found. Make sure the sheet has a Name column.");
      } else {
        toast.success(
          `Imported ${added} employee${added === 1 ? "" : "s"}${
            skipped > 0 ? ` (${skipped} row${skipped === 1 ? "" : "s"} skipped — missing a name)` : ""
          }`,
        );
        setOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Couldn't read that file. Make sure it's a valid .xlsx, .xls or .csv file.");
    } finally {
      reset();
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
      <DialogContent className="sm:max-w-md">
        {importing ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Importing employees...</p>
              <p className="text-sm text-muted-foreground">Reading {file?.name}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="pb-1">
              <h2 className="text-base font-semibold">Import from Excel</h2>
              <p className="text-sm text-muted-foreground">
                Upload a .xlsx, .xls or .csv file to add employees to the directory.
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
                Recognized columns: Employee ID, Full Name, Office, Department, Position, Start
                Date, Birthday, Status, Date Resigned, Job Offer Date. Only Full Name is required
                — everything else is optional.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!file}>
                Import
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
