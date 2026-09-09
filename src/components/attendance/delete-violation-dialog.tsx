import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ViolationRecord } from "@/data/violation-api";
import { useDeleteViolation } from "@/data/violation-store";

// Single-record equivalent of bulk-delete-dialog.tsx — same soft-delete
// ("kept for the audit trail, not fully erased") but no typed confirmation
// needed for just one row; the record's own details shown here are the
// confirmation. Replaces the previous window.confirm() call in
// attendance-violations.tsx with something that actually matches the rest of
// the module's dialogs.
export function DeleteViolationDialog({
  record,
  open,
  onOpenChange,
  onDeleted,
}: {
  record: ViolationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteMutation = useDeleteViolation();

  function handleDelete() {
    if (!record) return;
    deleteMutation.mutate(record.id, {
      onSuccess: () => {
        toast.success(`Deleted the record for ${record.employeeName}`);
        onOpenChange(false);
        onDeleted();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (deleteMutation.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this record?</DialogTitle>
          <DialogDescription>
            This is kept for the audit trail, not fully erased, but can't be recovered through
            the app.
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{record.employeeName}</p>
            <p className="text-muted-foreground">
              {record.violationTypeLabel} — {record.violationDate} ({record.violationRecordId})
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={handleDelete}>
            {deleteMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
