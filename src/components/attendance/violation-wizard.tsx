import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  History,
  Mail,
  PauseCircle,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SendConfirmDialog, type ConfirmableAction } from "@/components/attendance/send-confirm-dialog";
import { canEditViolation, EditViolationDialog } from "@/components/attendance/edit-violation-dialog";
import type { EmailStatus, ViolationRecordDetail } from "@/data/violation-api";
import {
  useEmailSenderConfigQuery,
  useViolationHistoryQuery,
  useViolationQuery,
  useViolationTransition,
  type TransitionAction,
} from "@/data/violation-store";
import { useCurrentAccount } from "@/lib/session";
import { canApproveAttendance, canManageAttendance } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// The four workflow stages a record moves through end-to-end. Hold / Needs
// Correction / Failed are exceptions that pause the flow rather than stages
// of their own — shown as a banner over whichever step they paused, not as
// extra nodes in the stepper. Ported from the standalone attendance app's
// src/components/violation-wizard.tsx (that app's simple step-index state
// machine, since this app has no shared stepper primitive either).
const STEPS = [
  { key: "prepare", label: "Ready to Prepare" },
  { key: "review", label: "Review & Approve" },
  { key: "send", label: "Send" },
  { key: "sent", label: "Sent" },
] as const;

function stepIndexFor(status: EmailStatus): number {
  switch (status) {
    case "Draft":
    case "Ready to Prepare":
      return 0;
    case "Email Prepared":
    case "Hold":
    case "Needs Correction":
      return 1;
    case "Approved":
    case "Resend Approved":
    case "Failed":
      return 2;
    case "Sent":
      return 3;
    default:
      return 0;
  }
}

function Stepper({ status }: { status: EmailStatus }) {
  const current = stepIndexFor(status);
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                i < current && "border-primary bg-primary text-primary-foreground",
                i === current && "border-primary text-primary",
                i > current && "border-border text-muted-foreground",
              )}
            >
              {i < current ? <Check className="size-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "max-w-20 text-center text-[11px] leading-tight",
                i === current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("mx-2 h-0.5 flex-1 rounded", i < current ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBanner({ record }: { record: ViolationRecordDetail }) {
  if (record.emailStatus === "Hold") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <PauseCircle className="mt-0.5 size-4 shrink-0" />
        <span>On hold — the automation will not send this until it's marked Ready to Prepare again.</span>
      </div>
    );
  }
  if (record.emailStatus === "Needs Correction") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>Flagged for correction. Edit the record's details, then mark it Ready to Prepare again.</span>
      </div>
    );
  }
  if (record.emailStatus === "Failed") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Send failed</p>
          <p className="mt-0.5 text-destructive/90">{record.automationError || "No error detail was recorded."}</p>
        </div>
      </div>
    );
  }
  if (record.emailStatus === "Draft") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        <CircleDashed className="mt-0.5 size-4 shrink-0" />
        <span>Still a draft — mark it Ready to Prepare once every field is confirmed.</span>
      </div>
    );
  }
  return null;
}

function EmailPreview({ record }: { record: ViolationRecordDetail }) {
  const { data: config } = useEmailSenderConfigQuery();
  const fromAddress = record.fromPreview ?? config?.fromAddress ?? "…";
  const ccAddress = record.ccPreview ?? config?.fromAddress ?? "…";

  return (
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
      {/* bodyPreview is HTML (bold name/labels, see
          backend/app/services/violation_email_template.py) — rendered as
          markup rather than plain text so the preview matches the real email. */}
      <div
        className="px-4 py-3 text-sm [&_a]:underline [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold"
        dangerouslySetInnerHTML={{ __html: record.bodyPreview ?? "" }}
      />
    </div>
  );
}

export function ViolationWizard({
  recordId,
  open,
  onOpenChange,
}: {
  recordId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: account } = useCurrentAccount();
  const canApprove = canApproveAttendance(account?.permissions);
  const canWrite = canManageAttendance(account?.permissions);
  const [pendingAction, setPendingAction] = useState<ConfirmableAction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: record } = useViolationQuery(open ? recordId : null);
  const { data: history } = useViolationHistoryQuery(open ? recordId : null);
  const transition = useViolationTransition();

  if (!record) return null;

  // TS's narrowing from the `if (!record) return null` guard above doesn't
  // reach into runTransition's closure (a nested function could in principle
  // be invoked after `record` changes), so capture the narrowed value in its
  // own binding instead of relying on the outer `record` staying non-null.
  const currentRecord = record;
  const status = currentRecord.emailStatus;
  const busy = transition.isPending;

  function runTransition(action: TransitionAction) {
    transition.mutate(
      { id: currentRecord.id, action },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed") },
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {record.employeeName} <span className="font-normal text-muted-foreground">— {record.violationRecordId}</span>
            </DialogTitle>
            <DialogDescription>
              {record.violationTypeLabel} · {record.office} · {record.violationDate}
              {!canApprove && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs">
                  <ShieldCheck className="size-3" /> view-only — approval required
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <Stepper status={status} />
            <StatusBanner record={record} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span> <Badge>{status}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reason:</span> {record.reason}
                  </div>
                  {record.createdByName && (
                    <div>
                      <span className="text-muted-foreground">Created by:</span> {record.createdByName}
                    </div>
                  )}
                  {record.approvedByName && (
                    <div>
                      <span className="text-muted-foreground">Approved by:</span> {record.approvedByName}
                    </div>
                  )}
                  {record.fromAddress && (
                    <div>
                      <span className="text-muted-foreground">From override:</span> {record.fromAddress}
                    </div>
                  )}
                  {record.ccAddresses && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Extra Cc:</span> {record.ccAddresses}
                    </div>
                  )}
                </div>

                {canEditViolation(status) && canWrite && (
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-3.5" /> Edit details
                  </Button>
                )}

                {(status === "Draft" || status === "Ready to Prepare") && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      {status === "Draft"
                        ? "Confirm the details above, then move this into the preparation queue."
                        : "The automation will validate this record and generate the email content."}
                    </p>
                    {canWrite ? (
                      <Button disabled={busy} onClick={() => runTransition(status === "Draft" ? "mark-ready" : "prepare")}>
                        {status === "Draft" ? "Mark Ready to Prepare" : "Prepare email"}
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">You don't have permission to advance this record.</p>
                    )}
                  </div>
                )}

                {(status === "Email Prepared" || status === "Hold" || status === "Needs Correction") && (
                  <div className="flex flex-col gap-3">
                    {status === "Email Prepared" &&
                      (canApprove ? (
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={busy} onClick={() => setPendingAction("approve")}>
                            Approve
                          </Button>
                          <Button variant="outline" disabled={busy} onClick={() => runTransition("hold")}>
                            Hold
                          </Button>
                          <Button variant="destructive" disabled={busy} onClick={() => runTransition("needs-correction")}>
                            Needs Correction
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Awaiting review — you don't have permission to approve, hold, or flag this record.
                        </p>
                      ))}
                    {(status === "Hold" || status === "Needs Correction") &&
                      (canWrite ? (
                        <Button disabled={busy} onClick={() => runTransition("mark-ready")}>
                          Mark Ready to Prepare again
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">You don't have permission to resume this record.</p>
                      ))}
                  </div>
                )}

                {(status === "Approved" || status === "Resend Approved" || status === "Failed") && (
                  <div className="flex flex-col gap-3">
                    {status === "Failed" ? (
                      canApprove && (
                        <Button disabled={busy} onClick={() => setPendingAction("reapprove")}>
                          Re-approve &amp; retry
                        </Button>
                      )
                    ) : canApprove ? (
                      <Button disabled={busy} onClick={() => setPendingAction("send-now")}>
                        <Send className="size-4" /> Send now
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Awaiting an approver to send this email.</p>
                    )}
                  </div>
                )}

                {status === "Sent" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Check className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <p className="font-medium">Sent {record.sentAt ? new Date(record.sentAt).toLocaleString() : ""}</p>
                        <p className="mt-0.5">
                          To {record.sentTo} · Reference: {record.zohoMessageId || "not returned"}
                        </p>
                      </div>
                    </div>
                    {canApprove && (
                      <Button variant="outline" disabled={busy} onClick={() => runTransition("resend")}>
                        <RotateCcw className="size-4" /> Resend
                      </Button>
                    )}
                  </div>
                )}

                <div className="mt-auto border-t pt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <History className="size-3.5" /> Activity history
                  </p>
                  <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
                    {history?.map((h) => (
                      <li key={h.id}>
                        {new Date(h.createdAt).toLocaleString()} — {h.action} ({h.actorLabel})
                      </li>
                    ))}
                    {history?.length === 0 && <li>No history yet.</li>}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Mail className="size-4" /> Email preview
                </p>
                <EmailPreview record={record} />
                {record.previousViolations.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Previous violations this month: {record.previousViolations.length} on file.
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SendConfirmDialog
        recordId={recordId}
        action={pendingAction ?? "approve"}
        open={pendingAction !== null}
        onOpenChange={(next) => !next && setPendingAction(null)}
        busy={transition.isPending}
        onConfirm={() => {
          if (!pendingAction) return;
          const action = pendingAction === "send-now" ? "send-now" : "approve";
          transition.mutate(
            { id: currentRecord.id, action },
            { onSuccess: () => setPendingAction(null), onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed") },
          );
        }}
      />

      <EditViolationDialog record={record} open={editOpen} onOpenChange={setEditOpen} onSaved={() => {}} />
    </>
  );
}
