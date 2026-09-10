import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Send, TriangleAlert } from "lucide-react";

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
import { EmailChipInput } from "@/components/attendance/email-chip-input";
import { useAppSettingsQuery } from "@/data/app-settings-store";
import { useEmailSenderConfigQuery, useSendViaOutlook, useViolationQuery } from "@/data/violation-store";
import { buildMailtoUrl, htmlToPlainText, openMailto } from "@/lib/mailto";

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
//
// When a Super Admin has turned on "Use MS Outlook" (see
// backend/app/models/app_settings.py's use_outlook_for_violations) and this
// is specifically the "send-now" action, this dialog switches to a
// different flow entirely: instead of delegating to the parent's onConfirm
// (which fires the normal Zoho Mail send), it lets the sender adjust
// From/Cc right here, marks the record Sent via the Outlook alternate path
// itself, and opens the composed email in the sender's own Outlook. Approve
// and Re-approve are untouched by the toggle either way — neither of those
// ever sends an email directly (see backend/app/api/routes/violations.py).
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
  // For "send-now" specifically, whether this dialog behaves as the Outlook
  // path or the real Zoho send depends entirely on this setting — and
  // useAppSettingsQuery has no cache guarantee, so `appSettings` can still be
  // undefined for a render or two right after the dialog opens (e.g. the
  // very first time it's opened this session). Treating that "not loaded
  // yet" as settingsLoading (rather than defaulting outlookMode to false)
  // keeps the dialog from ever briefly rendering the wrong action button —
  // it showed the real Zoho "Send now" button for a moment even with
  // Outlook mode on, and clicking it in that window fired a real send
  // instead of the Outlook one.
  const { data: appSettings, isLoading: settingsLoading } = useAppSettingsQuery(open);
  const outlookMode = action === "send-now" && !!appSettings?.useOutlookForViolations;
  const waitingOnSettings = action === "send-now" && settingsLoading;
  const sendViaOutlook = useSendViaOutlook();

  const [fromOverride, setFromOverride] = useState("");
  const [ccOverride, setCcOverride] = useState("");

  // Re-seed the override fields from the record's own stored values every
  // time the dialog opens — same reasoning as EditViolationDialog: a
  // previous cancelled edit shouldn't linger into the next open.
  useEffect(() => {
    if (open && record) {
      setFromOverride(record.fromAddress ?? "");
      setCcOverride(record.ccAddresses ?? "");
    }
  }, [open, record]);

  const copy = ACTION_COPY[action];
  const fromAddress = record?.fromPreview ?? config?.fromAddress ?? "…";
  const ccAddress = record?.ccPreview ?? config?.fromAddress ?? "…";

  async function handleOutlookConfirm() {
    if (!record) return;
    try {
      const updated = await sendViaOutlook.mutateAsync({
        id: record.id,
        overrides: { fromAddress: fromOverride, ccAddresses: ccOverride },
      });
      const url = buildMailtoUrl({
        to: updated.employeeEmail,
        cc: updated.ccPreview,
        subject: updated.subjectPreview ?? "",
        body: htmlToPlainText(updated.bodyPreview ?? ""),
      });
      openMailto(url);
      toast.success("Marked as sent — finish it from the Outlook window that just opened.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't mark this as sent");
    }
  }

  const outlookBusy = sendViaOutlook.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && !outlookBusy && onOpenChange(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{outlookMode ? "Send this email via Outlook?" : copy.title}</DialogTitle>
          <DialogDescription>
            {outlookMode
              ? "This marks the record Sent and opens it in your own Outlook to actually send — nothing goes through Zoho Mail."
              : copy.note}
          </DialogDescription>
        </DialogHeader>

        {!record || waitingOnSettings ? (
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

        {outlookMode && record && !waitingOnSettings && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Please make sure Outlook is already open before continuing — this marks the record Sent
                right away, so it's easiest to have the compose window land somewhere you'll actually see it.
              </span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Before opening Outlook</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Send from</label>
              <Input
                type="email"
                placeholder="Use default sender"
                value={fromOverride}
                onChange={(e) => setFromOverride(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Outlook sends from whichever account you're signed into there — this just records who this
                should have gone out as. Switch mailboxes in Outlook itself before sending if it needs to
                match.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Additional Cc addresses</label>
              <EmailChipInput value={ccOverride} onChange={setCcOverride} placeholder="Type an email…" />
              <p className="text-[11px] text-muted-foreground">
                The default sender always stays Cc'd regardless — these are added on top of it.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy || outlookBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {outlookMode ? (
            <Button disabled={outlookBusy || !record || waitingOnSettings} onClick={handleOutlookConfirm}>
              {outlookBusy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Open in Outlook
            </Button>
          ) : (
            <Button disabled={busy || !record || waitingOnSettings} onClick={onConfirm}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {copy.confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
