import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEmailSenderConfigQuery, useViolationQuery } from "@/data/violation-store";

export type ConfirmableAction = "approve" | "send-now" | "reapprove";

const ACTION_COPY: Record<ConfirmableAction, { title: string; confirmLabel: string; note: string }> = {
  approve: {
    title: "Approve this email?",
    confirmLabel: "Approve",
    note: "Once approved, the send worker picks this up automatically within a couple of minutes — there's no review step after this one.",
  },
  "send-now": {
    title: "Send this email now?",
    confirmLabel: "Send now",
    note: "This sends immediately. There's no undo once it's gone out.",
  },
  reapprove: {
    title: "Re-approve and retry this send?",
    confirmLabel: "Re-approve & retry",
    note: "This clears the failure and queues it for another send attempt, logged as a fresh approval.",
  },
};

// Opened right before an Approve / Send now / Re-approve action actually
// fires — from the attendance table's one-click row buttons and from the
// wizard alike — so nothing goes out (or gets queued to go out) without the
// sender seeing the exact rendered email first. Ported from the standalone
// attendance app's src/components/send-confirm-dialog.tsx.
export function SendConfirmDialog({
  recordId,
  action,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  recordId: number | null;
  action: ConfirmableAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { data: record } = useViolationQuery(open ? recordId : null);
  const { data: config } = useEmailSenderConfigQuery(open);

  const copy = ACTION_COPY[action];
  const fromAddress = record?.fromPreview ?? config?.fromAddress ?? "…";
  const ccAddress = record?.ccPreview ?? config?.fromAddress ?? "…";

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.note}</DialogDescription>
        </DialogHeader>

        {!record ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="space-y-1 border-b bg-muted/40 px-4 py-3 text-xs">
              <div className="flex gap-2">
                <span className="w-14 shrink-0 text-muted-foreground">From</span>
                <span>{fromAddress}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-14 shrink-0 text-muted-foreground">To</span>
                <span>{record.employeeEmail}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-14 shrink-0 text-muted-foreground">Cc</span>
                <span>{ccAddress}</span>
              </div>
              <div className="flex gap-2 pt-1 font-medium">
                <span className="w-14 shrink-0 font-normal text-muted-foreground">Subject</span>
                <span>{record.subjectPreview}</span>
              </div>
            </div>
            <div
              className="max-h-64 overflow-y-auto px-4 py-3 text-sm [&_a]:underline [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: record.bodyPreview ?? "" }}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !record} onClick={onConfirm}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
