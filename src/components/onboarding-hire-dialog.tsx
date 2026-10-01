// Add/edit form dialog for a single onboarding tracker row — ported from the
// source onboarding app's hire-form-dialog.tsx, but rebuilt with Workforce's
// own ui/ primitives and toast pattern (see new-hire-dialog.tsx) instead of
// that app's ConfirmDialog + custom form. startDate stays a plain free-text
// field in storage (matching new_hire.py's start_date column), but this form
// splits it into a real date picker + a time combobox for editing — see
// combineOnboardingStartDate/parseOnboardingStartDateForForm in
// @/data/new-hire-api for the two-way conversion.

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  combineOnboardingStartDate,
  parseOnboardingStartDateForForm,
  type NewHire,
  type NewHireInput,
} from "@/data/new-hire-api";
import { useCreateNewHire, useUpdateNewHire } from "@/data/new-hire-store";
import { cn } from "@/lib/utils";

// Half-hour slots across a typical workday — a quick pick for the common
// case. Not a closed list: typing anything else just uses that text
// verbatim, since this is still a free-text field in storage.
const STANDARD_TIMES = [
  "7:00 AM",
  "7:30 AM",
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
];

/** Dropdown of standard times that also accepts typing something custom —
 * local to this dialog, not backed by /list-options (unlike
 * CreatableComboboxField): "time of day" isn't an org-wide managed preset
 * list, just a quick-pick shortcut over an otherwise free-text field. */
function TimeComboboxField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // A custom value typed in previously stays selectable (and shown as
  // selected) even though it isn't one of the standard slots.
  const options =
    value && !STANDARD_TIMES.includes(value) ? [...STANDARD_TIMES, value] : STANDARD_TIMES;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value || "Select or type a time..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="e.g. 9:00 AM" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange(query.trim());
                    setOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Use &quot;{query.trim()}&quot;
                </button>
              ) : (
                <span className="text-muted-foreground">No matches.</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((t) => (
                <CommandItem
                  key={t}
                  value={t}
                  onSelect={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", value === t ? "opacity-100" : "opacity-0")}
                  />
                  {t}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function blankForm(): NewHireInput {
  return {
    name: "",
    roleTitle: "",
    startDate: "",
    recruitmentLead: "",
    onboardingSpecialist: "",
  };
}

function formFromHire(hire: NewHire): NewHireInput {
  return {
    name: hire.name,
    roleTitle: hire.roleTitle,
    startDate: hire.startDate,
    recruitmentLead: hire.recruitmentLead,
    onboardingSpecialist: hire.onboardingSpecialist,
  };
}

export function OnboardingHireDialog({
  hire,
  trigger,
  onCreated,
}: {
  /** Omit (or pass null) for "Add new hire" mode, which renders its own
   * default trigger button; pass an existing row to edit it instead — the
   * caller then supplies `trigger` (e.g. a small pencil icon button in a
   * table row), since there's no one sensible default for that case. */
  hire?: NewHire | null;
  trigger?: ReactNode;
  /** Called right after a brand-new row is created (not on an edit) — the
   * onboarding page uses this to clear its filters/pagination so the new
   * row is immediately visible, same as new-hire-dialog.tsx's onCreated. */
  onCreated?: (hire: NewHire) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewHireInput>(() => (hire ? formFromHire(hire) : blankForm()));
  // Split out of form.startDate for editing — a real date picker plus a
  // time combobox, recombined into form.startDate on submit.
  const [startDateOnly, setStartDateOnly] = useState("");
  const [startTime, setStartTime] = useState("");
  const createMutation = useCreateNewHire();
  const updateMutation = useUpdateNewHire();
  const saving = createMutation.isPending || updateMutation.isPending;

  // Re-seed the form every time the dialog opens, from whatever `hire` is at
  // that moment — same pattern as HireFormDialog in the source app.
  useEffect(() => {
    if (!open) return;
    const nextForm = hire ? formFromHire(hire) : blankForm();
    setForm(nextForm);
    const { date, time } = parseOnboardingStartDateForForm(nextForm.startDate ?? "");
    setStartDateOnly(date);
    setStartTime(time);
  }, [open, hire]);

  function set<K extends keyof NewHireInput>(key: K, value: NewHireInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    const submission: NewHireInput = {
      ...form,
      startDate: combineOnboardingStartDate(startDateOnly, startTime),
    };
    try {
      if (hire) {
        await updateMutation.mutateAsync({ id: hire.id, patch: submission });
        toast.success(`Saved changes to ${form.name}`);
      } else {
        const created = await createMutation.mutateAsync(submission);
        toast.success(`Added ${form.name} to the onboarding tracker`);
        onCreated?.(created);
      }
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(
        hire
          ? `Couldn't save changes to ${form.name || "this new hire"}. Please try again.`
          : "Couldn't add that new hire. Please try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add new hire
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{hire ? "Edit new hire" : "Add new hire"}</DialogTitle>
            <DialogDescription>
              {hire
                ? "Update this new hire's basic details."
                : "Saved to the onboarding tracker and logged in the activity log."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nh-name">Name</Label>
              <Input
                id="nh-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Juan Dela Cruz"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nh-role">Role</Label>
              <Input
                id="nh-role"
                value={form.roleTitle ?? ""}
                onChange={(e) => set("roleTitle", e.target.value)}
                placeholder="Customer Support Rep"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nh-start-date">Start date</Label>
                <Input
                  id="nh-start-date"
                  type="date"
                  value={startDateOnly}
                  onChange={(e) => setStartDateOnly(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Start time</Label>
                <TimeComboboxField value={startTime} onChange={setStartTime} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nh-lead">Recruitment Lead</Label>
                <Input
                  id="nh-lead"
                  value={form.recruitmentLead ?? ""}
                  onChange={(e) => set("recruitmentLead", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nh-specialist">Onboarding Specialist</Label>
                <Input
                  id="nh-specialist"
                  value={form.onboardingSpecialist ?? ""}
                  onChange={(e) => set("onboardingSpecialist", e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : hire ? "Save changes" : "Add new hire"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
