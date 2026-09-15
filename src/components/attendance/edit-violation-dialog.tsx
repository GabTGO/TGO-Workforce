import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmailChipInput } from "@/components/attendance/email-chip-input";
import {
  OFFICES,
  VIOLATION_TYPES,
  type Office,
  type PreviousViolationEntry,
  type ViolationRecordDetail,
  type ViolationType,
  type ViolationUpdateInput,
} from "@/data/violation-api";
import {
  useEmailSenderConfigQuery,
  useUpdateViolation,
  useViolationQuery,
} from "@/data/violation-store";

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
  // The Add/Edit/Delete list is shown (and editable) as soon as the dialog
  // opens — seeded below from record.previousViolations, whether that came
  // from auto-detection or an existing override, so there's no extra click
  // needed to see or change it. `null` only ever happens after the user
  // clicks "Reset to auto-detected" (see PreviousViolationsEditor below) —
  // it's the signal to PATCH sends meaning "go back to auto-detecting from
  // the logs," not a state this form starts in.
  previousViolationsOverride: PreviousViolationEntry[] | null;
};

function toForm(record: ViolationRecordDetail): FormState {
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
    previousViolationsOverride: record.previousViolations.map((e) => ({ ...e })),
  };
}

export function canEditViolation(status: string): boolean {
  return EDITABLE_STATUSES.has(status);
}

/** The Add/Edit/Delete controls for a record's "Previous attendance
 * violation for this month" list — shown as soon as the dialog opens (see
 * toForm above), no extra click needed to reach it. Each row is directly
 * editable in place — no separate add/edit sub-dialog — since an entry is
 * just a violation type plus a date. */
function PreviousViolationsEditor({
  entries,
  onChange,
  defaultDate,
  defaultType,
}: {
  entries: PreviousViolationEntry[];
  onChange: (next: PreviousViolationEntry[]) => void;
  defaultDate: string;
  defaultType: ViolationType;
}) {
  function updateEntry(index: number, patch: Partial<PreviousViolationEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }
  function addEntry() {
    onChange([
      ...entries,
      { violationDate: defaultDate, violationType: defaultType, violationTypeOther: null },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nothing listed — add an entry, or reset to auto-detected.
        </p>
      )}
      {entries.map((entry, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 rounded-md border p-1.5 sm:flex-row sm:items-center sm:flex-wrap"
        >
          <Select
            value={entry.violationType}
            onValueChange={(v) =>
              updateEntry(i, {
                violationType: v as ViolationType,
                violationTypeOther: v === "Other" ? entry.violationTypeOther : null,
              })
            }
          >
            <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-auto sm:flex-1 sm:basis-32">
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
          {entry.violationType === "Other" && (
            <Input
              className="h-8 w-full min-w-0 text-xs sm:w-auto sm:flex-1 sm:basis-28"
              placeholder="Specify"
              value={entry.violationTypeOther ?? ""}
              onChange={(e) => updateEntry(i, { violationTypeOther: e.target.value })}
            />
          )}
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="h-8 w-full min-w-0 text-xs sm:w-auto sm:flex-1 sm:basis-36"
              value={entry.violationDate}
              onChange={(e) => updateEntry(i, { violationDate: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeEntry(i)}
              aria-label="Remove entry"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEntry}>
        <Plus className="size-3.5" /> Add entry
      </Button>
    </div>
  );
}

/** The actual form — only ever mounted once `record` (a full
 * ViolationRecordDetail) has loaded, so `form` can stay a plain non-nullable
 * FormState instead of every setForm callback having to deal with a
 * possibly-null previous value. Remounts fresh (via the `key={record.id}` at
 * the call site below) whenever the dialog opens for a different/refetched
 * record. */
function EditViolationForm({
  record,
  onOpenChange,
  onSaved,
}: {
  record: ViolationRecordDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(record));
  const updateMutation = useUpdateViolation();

  const { data: config } = useEmailSenderConfigQuery();
  const defaultAddress = config?.fromAddress ?? "the configured default";
  const alternateAliases = (config?.knownFromAddresses ?? []).filter(
    (a) => a !== config?.fromAddress,
  );

  const original = toForm(record);
  const previousViolationsChanged =
    JSON.stringify(form.previousViolationsOverride) !==
    JSON.stringify(original.previousViolationsOverride);
  const hasChanges =
    (Object.keys(form) as (keyof FormState)[]).some(
      (key) => key !== "previousViolationsOverride" && form[key] !== original[key],
    ) || previousViolationsChanged;
  const otherMissing = form.violationType === "Other" && !form.violationTypeOther.trim();

  function handleSave() {
    const changes: ViolationUpdateInput = {};
    (Object.keys(form) as (keyof FormState)[]).forEach((key) => {
      if (key === "previousViolationsOverride") return;
      if (form[key] !== original[key]) {
        (changes as Record<string, string>)[key] = form[key] as string;
      }
    });
    if (previousViolationsChanged) {
      changes.previousViolationsOverride = form.previousViolationsOverride;
    }
    updateMutation.mutate(
      { id: record.id, changes },
      {
        onSuccess: () => {
          toast.success("Record updated");
          onOpenChange(false);
          onSaved();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't save those changes"),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit record details</DialogTitle>
        <DialogDescription>
          {record.violationRecordId} · only available while this record is Draft, Ready to Prepare,
          or Needs Correction — approving or preparing locks these fields.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Office</label>
          <Select
            value={form.office}
            onValueChange={(v) => setForm((f) => ({ ...f, office: v as Office }))}
          >
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
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Please specify the violation type
            </label>
            <Input
              value={form.violationTypeOther}
              onChange={(e) => setForm((f) => ({ ...f, violationTypeOther: e.target.value }))}
            />
          </div>
        )}
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Employee name</label>
          <Input
            value={form.employeeName}
            onChange={(e) => setForm((f) => ({ ...f, employeeName: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2 flex flex-col gap-1">
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
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Reason</label>
          <Textarea
            rows={3}
            placeholder="Leave blank for 'No reason given'"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>

        <div className="sm:col-span-2 border-t pt-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Previous attendance violation for this month
            </p>
            {form.previousViolationsOverride !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setForm((f) => ({ ...f, previousViolationsOverride: null }))}
              >
                Reset to auto-detected
              </Button>
            )}
          </div>
          {form.previousViolationsOverride === null ? (
            <p className="text-xs text-muted-foreground">
              Will auto-detect from this employee's other Sent records this month once saved.
            </p>
          ) : (
            <PreviousViolationsEditor
              entries={form.previousViolationsOverride}
              onChange={(next) => setForm((f) => ({ ...f, previousViolationsOverride: next }))}
              defaultDate={record.violationDate}
              defaultType={record.violationType}
            />
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {record.previousViolationsIsOverride
              ? "Manually set — shown exactly as listed here in the notice email, instead of auto-detecting."
              : "Auto-detected from this employee's other Sent records this month — add, change, or remove an entry below if the system missed one or got it wrong."}
          </p>
        </div>

        <div className="sm:col-span-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Sender &amp; Cc for this notice
          </p>
        </div>
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From address override</label>
          <Select
            value={form.fromAddress || "__default__"}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, fromAddress: v === "__default__" ? "" : v }))
            }
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
            Only addresses Zoho has actually validated for this account are offered here — a
            hand-typed address that isn't validated would just fail at send time.
          </p>
        </div>
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Additional Cc addresses</label>
          <EmailChipInput
            value={form.ccAddresses}
            onChange={(v) => setForm((f) => ({ ...f, ccAddresses: v }))}
            placeholder="Type an email…"
          />
          <p className="text-[11px] text-muted-foreground">
            {defaultAddress} always stays Cc'd regardless — these are added on top of it, not
            instead.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          disabled={updateMutation.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          disabled={!hasChanges || updateMutation.isPending || otherMissing}
          onClick={handleSave}
        >
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Pencil className="size-4" />
          )}
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditViolationDialog({
  recordId,
  open,
  onOpenChange,
  onSaved,
}: {
  recordId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  // Fetches the full ViolationRecordDetail itself (same pattern as
  // SendConfirmDialog) rather than requiring the caller to already have one
  // on hand — attendance-violations.tsx's row/bulk views only ever have the
  // plain list-row shape, which is missing previousViolations/
  // previousViolationsIsOverride entirely. React Query dedupes this against
  // whatever the wizard already fetched for the same id, so opening Edit
  // from inside the wizard doesn't refetch.
  const { data: record } = useViolationQuery(open ? recordId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {record ? (
          // key={record.id} remounts EditViolationForm (resetting its form
          // state from scratch) if this dialog is ever reused for a
          // different record without fully closing first.
          <EditViolationForm
            key={record.id}
            record={record}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Edit record details</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
