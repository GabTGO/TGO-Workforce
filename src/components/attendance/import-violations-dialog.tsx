import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportPreviewResult } from "@/data/violation-api";
import { useCommitImport, usePreviewImport } from "@/data/violation-store";

type Phase = "pick" | "scanning" | "preview" | "committing" | "done";

// Two-phase import (scan/preview -> commit) — ported from the standalone
// attendance app's src/components/import-dialog.tsx.
export function ImportViolationsDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ successCount: number; rowCount: number; errorCount: number } | null>(null);

  const previewMutation = usePreviewImport();
  const commitMutation = useCommitImport();

  const reset = () => {
    setPhase("pick");
    setFile(null);
    setPreview(null);
    setIncluded(new Set());
    setResult(null);
  };

  function handleScan() {
    if (!file) return;
    setPhase("scanning");
    previewMutation.mutate(file, {
      onSuccess: (data) => {
        setPreview(data);
        setIncluded(new Set(data.rows.filter((r) => r.valid).map((r) => r.rowNumber)));
        setPhase("preview");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Couldn't read that file");
        setPhase("pick");
      },
    });
  }

  function handleCommit() {
    if (!preview) return;
    setPhase("committing");
    const rows = preview.rows.filter((r) => included.has(r.rowNumber));
    commitMutation.mutate(
      { filename: preview.filename, rows },
      {
        onSuccess: (data) => {
          setResult(data);
          setPhase("done");
          toast.success(`Imported ${data.successCount} record${data.successCount === 1 ? "" : "s"}`);
          onImported();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Import failed");
          setPhase("preview");
        },
      },
    );
  }

  const toggleRow = (rowNumber: number) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const validRows = preview?.rows.filter((r) => r.valid) ?? [];
  const allValidSelected = validRows.length > 0 && validRows.every((r) => included.has(r.rowNumber));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import tracker</DialogTitle>
          <DialogDescription>
            Upload the existing attendance tracker export (.xlsx / .csv). Nothing is added to the database until you
            confirm which rows to keep.
          </DialogDescription>
        </DialogHeader>

        {(phase === "pick" || phase === "scanning") && (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center hover:border-primary/40 hover:bg-muted/30">
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">{file ? file.name : "Choose a .xlsx or .csv file"}</span>
              <span className="text-xs text-muted-foreground">Rows are validated before anything is imported.</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button disabled={!file || phase === "scanning"} onClick={handleScan}>
              {phase === "scanning" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Scanning spreadsheet…
                </>
              ) : (
                "Scan file"
              )}
            </Button>
          </div>
        )}

        {(phase === "preview" || phase === "committing") && preview && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <p>
                <span className="font-medium text-foreground">{preview.validCount}</span> ready to import
                {preview.invalidCount > 0 && (
                  <span className="text-muted-foreground"> · {preview.invalidCount} need fixing (excluded)</span>
                )}
              </p>
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => setIncluded(allValidSelected ? new Set() : new Set(validRows.map((r) => r.rowNumber)))}
              >
                {allValidSelected ? "Deselect all" : "Select all valid"}
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Row</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.rowNumber} className={!r.valid ? "opacity-60" : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          disabled={!r.valid}
                          checked={included.has(r.rowNumber)}
                          onChange={() => toggleRow(r.rowNumber)}
                          className="size-4 accent-primary"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell>
                        <div>{r.employeeName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.employeeEmail || "—"}</div>
                      </TableCell>
                      <TableCell>{r.violationType || "—"}</TableCell>
                      <TableCell>{r.violationDate || "—"}</TableCell>
                      <TableCell>{r.office || "—"}</TableCell>
                      <TableCell>
                        {r.valid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="size-3.5" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-start gap-1 text-xs text-destructive">
                            <XCircle className="mt-0.5 size-3.5 shrink-0" /> {r.errors.join("; ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Start over
              </Button>
              <Button disabled={included.size === 0 || phase === "committing"} onClick={handleCommit}>
                {phase === "committing" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Importing…
                  </>
                ) : (
                  `Import ${included.size} record${included.size === 1 ? "" : "s"}`
                )}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                Imported {result.successCount} of {result.rowCount} selected rows.
                {result.errorCount > 0 && ` ${result.errorCount} failed at commit time.`}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
