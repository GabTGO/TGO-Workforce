// Add/edit form dialog for a single onboarding tracker row — ported from the
// source onboarding app's hire-form-dialog.tsx, but rebuilt with Workforce's
// own ui/ primitives and toast pattern (see new-hire-dialog.tsx) instead of
// that app's ConfirmDialog + custom form. startDate stays a plain free-text
// field (matching new_hire.py's start_date column) rather than the source
// dialog's <input type="datetime-local"> conversion — see
// backend/app/models/new_hire.py's comment for why.

import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { NewHire, NewHireInput } from "@/data/new-hire-api";
import { useCreateNewHire, useUpdateNewHire } from "@/data/new-hire-store";

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
  const [form, setForm] = useState<NewHireInput>(() =>
    hire ? formFromHire(hire) : blankForm(),
  );
  const createMutation = useCreateNewHire();
  const updateMutation = useUpdateNewHire();
  const saving = createMutation.isPending || updateMutation.isPending;

  // Re-seed the form every time the dialog opens, from whatever `hire` is at
  // that moment — same pattern as HireFormDialog in the source app.
  useEffect(() => {
    if (open) setForm(hire ? formFromHire(hire) : blankForm());
  }, [open, hire]);

  function set<K extends keyof NewHireInput>(key: K, value: NewHireInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    try {
      if (hire) {
        await updateMutation.mutateAsync({ id: hire.id, patch: form });
        toast.success(`Saved changes to ${form.name}`);
      } else {
        const created = await createMutation.mutateAsync(form);
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nh-role">Role</Label>
                <Input
                  id="nh-role"
                  value={form.roleTitle ?? ""}
                  onChange={(e) => set("roleTitle", e.target.value)}
                  placeholder="Customer Support Rep"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nh-start">Start date &amp; time</Label>
                <Input
                  id="nh-start"
                  value={form.startDate ?? ""}
                  onChange={(e) => set("startDate", e.target.value)}
                  placeholder="Sept 8, 2026 / 9:00 AM"
                />
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
