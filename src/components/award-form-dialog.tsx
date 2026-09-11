// Give / edit an award — one dialog for both: `award` present means edit
// (title/description/date only, employee is fixed), absent means give a new
// one (employee picker, restricted to Active employees only — the whole
// point of the restriction being that recognizing someone who's already
// left doesn't make sense here).

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Award } from "@/data/award-api";
import { useCreateAward, useUpdateAward } from "@/data/award-store";
import { useEmployees } from "@/data/employee-store";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AwardFormDialog({
  open,
  onOpenChange,
  award,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Non-null = editing this award; null = giving a new one. */
  award: Award | null;
}) {
  const isEdit = !!award;
  const employees = useEmployees();
  const activeEmployees = employees
    .filter((e) => e.status === "Active")
    .sort((a, b) => a.name.localeCompare(b.name));

  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [awardedDate, setAwardedDate] = useState(today());

  const createMutation = useCreateAward();
  const updateMutation = useUpdateAward();
  const busy = createMutation.isPending || updateMutation.isPending;

  // Re-seed every time the dialog opens (or the target award changes) —
  // same reasoning as every other edit-form dialog in this app: a previous
  // cancelled edit shouldn't linger into the next open.
  useEffect(() => {
    if (!open) return;
    setEmployeeId(award?.employeeId ?? "");
    setTitle(award?.title ?? "");
    setDescription(award?.description ?? "");
    setAwardedDate(award?.awardedDate ?? today());
  }, [open, award]);

  async function handleSubmit() {
    if (!isEdit && !employeeId) {
      toast.error("Choose which employee this award is for.");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the award a title.");
      return;
    }
    if (!awardedDate) {
      toast.error("Pick a date for this award.");
      return;
    }

    try {
      if (award) {
        await updateMutation.mutateAsync({
          id: award.id,
          patch: { title: title.trim(), description: description.trim(), awardedDate },
        });
        toast.success("Award updated");
      } else {
        await createMutation.mutateAsync({
          employeeId,
          title: title.trim(),
          description: description.trim(),
          awardedDate,
        });
        toast.success("Award given");
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Couldn't save this award. Please try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Award" : "Give an Award"}</DialogTitle>
          <DialogDescription>
            {award
              ? `Editing ${award.title} for ${award.employeeName}.`
              : "Recognize an active employee with a named award."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!isEdit && (
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an active employee" />
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.office}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only Active employees are listed — resigned or terminated employees
                can't be given a new award.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="award-title">Award title</Label>
            <Input
              id="award-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Employee of the Month"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="award-description">Description (optional)</Label>
            <Textarea
              id="award-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this award is being given..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="award-date">Date</Label>
            <Input
              id="award-date"
              type="date"
              value={awardedDate}
              onChange={(e) => setAwardedDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving..." : isEdit ? "Save changes" : "Give award"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
