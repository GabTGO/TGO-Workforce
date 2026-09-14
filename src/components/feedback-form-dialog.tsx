// "Report Feedback" — open to any signed-in account. Every new card starts
// at the default Pending status regardless of what's picked here; only
// Super Admin can move it afterward (see feedback.tsx's per-card controls).

import { useState } from "react";
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
import { useCreateFeedback } from "@/data/feedback-store";
import type { FeedbackPriority, FeedbackType } from "@/data/feedback-api";

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "improvement", label: "Improvement" },
];

const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function FeedbackFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const createMutation = useCreateFeedback();

  function reset() {
    setType("bug");
    setTitle("");
    setReason("");
    setPriority("medium");
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Give it a short title.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Add a reason — what's the bug, or what should improve?");
      return;
    }
    try {
      await createMutation.mutateAsync({
        type,
        title: title.trim(),
        reason: reason.trim(),
        priority,
      });
      toast.success("Feedback submitted — thanks!");
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't submit that. Please try again.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!createMutation.isPending) {
          onOpenChange(next);
          if (!next) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report Feedback</DialogTitle>
          <DialogDescription>
            Report a bug or suggest an improvement. It starts on the board as Pending — a Super
            Admin triages it from there.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as FeedbackPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-title">Title</Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "bug" ? "Export button does nothing on Safari" : "Add a dark mode toggle"}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-reason">Reason</Label>
            <Textarea
              id="feedback-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What happened, or what would this improve?"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={createMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
