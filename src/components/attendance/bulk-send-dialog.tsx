import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Send } from "lucide-react";

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
import { useAppSettingsQuery } from "@/data/app-settings-store";
import {
  useBulkPreviewViolationsQuery,
  useBulkSendNowViolations,
  useBulkSendViaOutlook,
  useEmailSenderConfigQuery,
} from "@/data/violation-store";
import { buildMailtoUrl, htmlToPlainText, openMailto } from "@/lib/mailto";

// The one-click row "Send now" button already goes through
// SendConfirmDialog; this is that same idea scaled up to a checkbox
// selection, but a bigger blast radius earns a heavier gate — a checklist
// that must be worked through by hand rather than one "are you sure" click.
// Ported from the standalone attendance app's
// src/components/bulk-send-dialog.tsx.
//
// When a Super Admin has turned on the mail-app alternate path (see
// backend/app/models/app_settings.py's use_outlook_for_violations — a plain
// mailto: link under the hood, so it opens whatever's registered as the
// sender's default mail app, not necessarily Outlook), confirming here marks
// every eligible record Sent via that alternate path (no Zoho Mail call) and
// opens one compose window per record in sequence, staggered slightly so
// the OS/browser has time to hand each one off before the next fires.
type Checks = { recipients: boolean; content: boolean; approved: boolean; irreversible: boolean };
const EMPTY_CHECKS: Checks = {
  recipients: false,
  content: false,
  approved: false,
  irreversible: false,
};

const MAIL_APP_OPEN_STAGGER_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BulkSendDialog({
  records,
  open,
  onOpenChange,
  onDone,
}: {
  records: ViolationRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [checks, setChecks] = useState<Checks>(EMPTY_CHECKS);
  const [openingMailApp, setOpeningMailApp] = useState(false);

  const eligible = records.filter(
    (r) => r.emailStatus === "Approved" || r.emailStatus === "Resend Approved",
  );
  const ineligible = records.filter(
    (r) => !(r.emailStatus === "Approved" || r.emailStatus === "Resend Approved"),
  );
  const ids = eligible.map((r) => r.id);

  const { data: previews, isLoading } = useBulkPreviewViolationsQuery(ids, open);
  const { data: config } = useEmailSenderConfigQuery(open);
  // See the matching comment in send-confirm-dialog.tsx: appSettings can
  // still be undefined for a render or two right after this dialog opens,
  // and confirming before it resolves would fall through to the real Zoho
  // bulk-send-now path even with Outlook mode on — settingsLoading keeps the
  // Confirm button disabled until it's certain which mode applies.
  const { data: appSettings, isLoading: settingsLoading } = useAppSettingsQuery(open);
  const outlookMode = !!appSettings?.useOutlookForViolations;
  const sendMutation = useBulkSendNowViolations();
  const outlookMutation = useBulkSendViaOutlook();
  const busy = sendMutation.isPending || outlookMutation.isPending || openingMailApp;

  const resetAndClose = () => {
    setChecks(EMPTY_CHECKS);
    onOpenChange(false);
  };

  function handleConfirm() {
    if (outlookMode) {
      handleOutlookConfirm();
      return;
    }
    sendMutation.mutate(ids, {
      onSuccess: (result) => {
        const parts: string[] = [];
        if (result.sent.length) parts.push(`${result.sent.length} sent`);
        if (result.failed.length) parts.push(`${result.failed.length} failed`);
        if (result.skipped.length) parts.push(`${result.skipped.length} skipped`);
        const summary = parts.join(", ") || "Nothing was sent";
        if (result.failed.length > 0) toast.error(`Bulk send finished — ${summary}`);
        else toast.success(`Bulk send finished — ${summary}`);
        resetAndClose();
        onDone();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Bulk send failed"),
    });
  }

  async function handleOutlookConfirm() {
    try {
      const result = await outlookMutation.mutateAsync(ids);
      resetAndClose();
      onDone();
      if (result.sent.length === 0) {
        toast.error("Nothing was marked as sent.");
        return;
      }
      toast.success(
        `Marked ${result.sent.length} as sent — opening ${result.sent.length} mail app window${
          result.sent.length === 1 ? "" : "s"
        } one at a time.`,
      );
      setOpeningMailApp(true);
      for (const record of result.sent) {
        openMailto(
          buildMailtoUrl({
            to: record.employeeEmail,
            cc: record.ccPreview,
            subject: record.subjectPreview ?? "",
            body: htmlToPlainText(record.bodyPreview ?? ""),
          }),
        );
        await delay(MAIL_APP_OPEN_STAGGER_MS);
      }
      setOpeningMailApp(false);
    } catch (err) {
      setOpeningMailApp(false);
      toast.error(err instanceof Error ? err.message : "Couldn't mark these as sent");
    }
  }

  const allChecked = Object.values(checks).every(Boolean);
  const defaultAddress = config?.fromAddress ?? "…";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {outlookMode ? "Mark " : "Send "}
            {eligible.length} email{eligible.length === 1 ? "" : "s"}{" "}
            {outlookMode ? "as sent" : "now"}?
          </DialogTitle>
          <DialogDescription>
            Only Approved / Resend Approved records can be sent this way. Work through the checklist
            below —
            {outlookMode
              ? " confirming marks every record below Sent and opens each one in your default mail app to actually send, one window at a time."
              : " confirming sends real emails immediately via Zoho Mail and can't be undone."}
          </DialogDescription>
        </DialogHeader>

        {outlookMode && eligible.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Please make sure your mail app is already open (or that you're signed in, if it's a
              web app like Zoho Mail) before continuing — confirming marks every record below Sent
              right away and opens one window per record in sequence.
            </span>
          </div>
        )}

        {ineligible.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {ineligible.length} of {records.length} selected record
              {records.length === 1 ? "" : "s"} will be skipped — not Approved:{" "}
              {ineligible.map((r) => r.employeeName).join(", ")}
            </span>
          </div>
        )}

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None of the selected records are Approved, so there's nothing to send.
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Employee</th>
                  <th className="px-3 py-1.5 font-medium">From</th>
                  <th className="px-3 py-1.5 font-medium">Cc</th>
                  <th className="px-3 py-1.5 font-medium">Subject</th>
                </tr>
              </thead>
              <tbody>
                {previews?.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-1.5">
                      {p.employeeName}{" "}
                      <span className="text-muted-foreground">({p.employeeEmail})</span>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {p.fromPreview ?? defaultAddress}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {p.ccPreview ?? defaultAddress}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-1.5">{p.subjectPreview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {eligible.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">Before sending, confirm:</p>
            <ChecklistItem
              checked={checks.recipients}
              onChange={(v) => setChecks((c) => ({ ...c, recipients: v }))}
              label="Every recipient's employee email address listed above is correct."
            />
            <ChecklistItem
              checked={checks.content}
              onChange={(v) => setChecks((c) => ({ ...c, content: v }))}
              label="I've reviewed the subject and body content for each record and it reflects what actually happened."
            />
            <ChecklistItem
              checked={checks.approved}
              onChange={(v) => setChecks((c) => ({ ...c, approved: v }))}
              label="Every record listed has already been through review and Approval — this step only sends, it does not approve."
            />
            <ChecklistItem
              checked={checks.irreversible}
              onChange={(v) => setChecks((c) => ({ ...c, irreversible: v }))}
              label={
                outlookMode
                  ? `I understand this marks ${eligible.length} record${eligible.length === 1 ? "" : "s"} Sent and opens ${eligible.length} mail app window${eligible.length === 1 ? "" : "s"} for me to actually send, and cannot be undone.`
                  : `I understand this sends ${eligible.length} real email${eligible.length === 1 ? "" : "s"} immediately (from the sender shown for each record above) and cannot be undone.`
              }
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            disabled={eligible.length === 0 || !allChecked || busy || settingsLoading}
            onClick={handleConfirm}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {outlookMode ? `Mark sent & open mail app` : `Confirm — send ${eligible.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}
