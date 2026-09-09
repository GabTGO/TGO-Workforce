import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmailChipInput } from "@/components/attendance/email-chip-input";
import { OFFICES, VIOLATION_TYPES, type Office, type ViolationRecord, type ViolationType } from "@/data/violation-api";
import { useEmailSenderConfigQuery, useUpdateViolation } from "@/data/violation-store";

// Matches backend/app/schemas/violation.py's ViolationRecordUpdate exactly,
// and the same three statuses PATCH /violations/{id} actually accepts
// (backend/app/api/routes/violations.py:update_record) — Draft, Ready to
// Prepare, and Needs Correction. Ported from the standalone attendance app's
// src/components/edit-record-dialog.tsx.
const EDITABLE_STATUSES = new Set(["Draft", "Ready to Prepare", "Needs Correction"]);

type FormState = {
  office: Office;
  employeeName: string;
  employeeEmail: string;
  violationType: ViolationType;
  violationTypeOther: string;
  violationDate: string;
  reason: string;
  ccAddresses: string;
  fromAddress: string;
};

function toForm(record: ViolationRecord): FormState {
  return {
    office: record.office,
    employeeName: record.employeeName,
    employeeEmail: record.employeeEmail,
    violationType: record.violationType,
    violationTypeOther: record.violationTypeOther ?? "",
    violationDate: record.violationDate,
    reason: record.reason ?? "",
    ccAddresses: record.ccAddresses ?? "",
    fromAddress: record.fromAddress ?? "",
  };
}

export function canEditViolation(status: string): boolean {
  return EDITABLE_STATUSES.has(status);
}

export function EditViolationDialog({
  record,
  open,
  onOpenChange,
  onSaved,
}: {
  record: ViolationRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(record));
  const updateMutation = useUpdateViolation();

  const { data: config } = useEmailSenderConfigQuery(open);
  const defaultAddress = config?.fromAddress ?? "the configured default";
  const alternateAliases = (config?.knownFromAddresses ?? []).filter((a) => a !== config?.fromAddress);

  // Re-seed the form from the record every time the dialog opens, so a
  // previous cancelled edit (or a change from someone else) isn't still
  // sitting in state next time this opens.
  useEffect(() => {
    if (open) setForm(toForm(record));
  }, [open, record]);

  const original = toForm(record);
  const hasChanges = (Object.keys(form) as (keyof FormState)[]).some((key) => form[key] !== original[key]);
  const otherMissing = form.violationType === "Other" && !form.violationTypeOther.trim();

  function handleSave() {
    const changes: Record<string, string> = {};
    (Object.keys(form) as (keyof FormState)[]).forEach((key) => {
      if (form[key] !== original[key]) changes[key] = form[key];
    });
    updateMutation.mutate(
      { id: record.id, changes },
      {
        onSuccess: () => {
          toast.success("Record updated");
          onOpenChange(false);
          onSaved();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save those changes"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !updateMutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit record details</DialogTitle>
          <DialogDescription>
            {record.violationRecordId} · only available while this record is Draft, Ready to Prepare, or Needs
            Correction — approving or preparing locks these fields.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Office</label>
            <Select value={form.office} onValueChange={(v) => setForm((f) => ({ ...f, office: v as Office }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFICES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Violation type</label>
            <Select
              value={form.violationType}
              onValueChange={(v) => setForm((f) => ({ ...f, violationType: v as ViolationType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIOLATION_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.violationType === "Other" && (
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Please specify the violation type</label>
              <Input
                value={form.violationTypeOther}
                onChange={(e) => setForm((f) => ({ ...f, violationTypeOther: e.target.value }))}
              />
            </div>
          )}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Employee name</label>
            <Input
              value={form.employeeName}
              onChange={(e) => setForm((f) => ({ ...f, employeeName: e.target.value }))}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Employee email</label>
            <Input
              type="email"
              value={form.employeeEmail}
              onChange={(e) => setForm((f) => ({ ...f, employeeEmail: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Violation date</label>
            <Input
              type="date"
              value={form.violationDate}
              onChange={(e) => setForm((f) => ({ ...f, violationDate: e.target.value }))}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Reason</label>
            <Textarea
              rows={3}
              placeholder="Leave blank for 'No reason given'"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Sender &amp; Cc for this notice</p>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">From address override</label>
            <Select
              value={form.fromAddress || "__default__"}
              onValueChange={(v) => setForm((f) => ({ ...f, fromAddress: v === "__default__" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use default ({defaultAddress})</SelectItem>
                {alternateAliases.map((address) => (
                  <SelectItem key={address} value={address}>
                    {address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Only addresses Zoho has actually validated for this account are offered here — a hand-typed address
              that isn't validated would just fail at send time.
            </p>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Additional Cc addresses</label>
            <EmailChipInput
              value={form.ccAddresses}
              onChange={(v) => setForm((f) => ({ ...f, ccAddresses: v }))}
              placeholder="Type an email…"
            />
            <p className="text-[11px] text-muted-foreground">
              {defaultAddress} always stays Cc'd regardless — these are added on top of it, not instead.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={updateMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!hasChanges || updateMutation.isPending || otherMissing} onClick={handleSave}>
            {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
