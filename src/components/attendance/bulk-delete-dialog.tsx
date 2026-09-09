import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ViolationRecord } from "@/data/violation-api";
import { useBulkDeleteViolations } from "@/data/violation-store";

// Same "kept for the audit trail, not fully erased" soft-delete as the
// single-record delete, but there's no one employee email to retype for a
// mixed selection — typing the literal word DELETE is the equivalent
// deliberate-action gate here. Ported from the standalone attendance app's
// src/components/bulk-delete-dialog.tsx.
export function BulkDeleteDialog({
  records,
  open,
  onOpenChange,
  onDeleted,
}: {
  records: ViolationRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const deleteMutation = useBulkDeleteViolations();

  function handleDelete() {
    deleteMutation.mutate(
      records.map((r) => r.id),
      {
        onSuccess: (result) => {
          const parts = [`${result.deleted.length} deleted`];
          if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
          toast.success(parts.join(", "));
          setConfirmText("");
          onOpenChange(false);
          onDeleted();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Bulk delete failed"),
      },
    );
  }

  const matches = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (deleteMutation.isPending) return;
        onOpenChange(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {records.length} record{records.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            These are kept for the audit trail, not fully erased, but can't be recovered through the app.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 overflow-y-auto rounded-lg border p-2 text-sm">
          {records.map((r) => (
            <li key={r.id} className="truncate py-0.5">
              {r.employeeName} — {r.violationTypeLabel} ({r.violationRecordId})
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">
            Type <span className="font-medium text-foreground">DELETE</span> to confirm
          </label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoFocus />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!matches || deleteMutation.isPending} onClick={handleDelete}>
            {deleteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete {records.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
