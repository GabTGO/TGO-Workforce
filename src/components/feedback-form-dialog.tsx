// "Report Feedback" — open to any signed-in account. Every new card starts
// at the default Pending status regardless of what's picked here; only
// Super Admin can move it afterward (see feedback.tsx's per-card controls).

import { useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { ImagePlus, X } from "lucide-react";
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
import { downscaleImage } from "@/lib/image-attachments";

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

// Matches the backend's MAX_SCREENSHOTS in app/api/routes/feedback.py.
const MAX_SCREENSHOTS = 6;

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
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateFeedback();

  function reset() {
    setType("bug");
    setTitle("");
    setReason("");
    setPriority("medium");
    setScreenshots([]);
  }

  async function attachFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Only images can be attached here.");
      return;
    }
    const room = MAX_SCREENSHOTS - screenshots.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    const toAttach = images.slice(0, room);
    if (images.length > toAttach.length) {
      toast.error(
        `Only added ${toAttach.length} — that's the ${MAX_SCREENSHOTS}-screenshot limit.`,
      );
    }
    setAttaching(true);
    try {
      const dataUrls = await Promise.all(toAttach.map(downscaleImage));
      setScreenshots((prev) => [...prev, ...dataUrls]);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't read one of those images. Try again.");
    } finally {
      setAttaching(false);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);
    if (imageFiles.length === 0) return;
    e.preventDefault();
    void attachFiles(imageFiles);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow picking the exact same file(s) again later
    if (files.length > 0) void attachFiles(files);
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
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
        screenshotUrls: screenshots,
      });
      toast.success("Feedback submitted — thanks!");
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Couldn't submit that. Please try again.",
      );
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
              placeholder={
                type === "bug" ? "Export button does nothing on Safari" : "Add a dark mode toggle"
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-reason">Reason</Label>
            <Textarea
              id="feedback-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onPaste={handlePaste}
              placeholder="What happened, or what would this improve? You can paste a screenshot here (Ctrl+V)."
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <Label>Screenshots (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <div className="flex flex-wrap gap-2">
              {screenshots.map((src, index) => (
                <div key={index} className="relative">
                  <img
                    src={src}
                    alt={`Screenshot ${index + 1}`}
                    className="h-16 w-16 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(index)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                    aria-label={`Remove screenshot ${index + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {screenshots.length < MAX_SCREENSHOTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attaching}
                  className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px]">{attaching ? "Adding…" : "Add"}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Attach a file, or paste a screenshot into Reason with Ctrl+V — up to {MAX_SCREENSHOTS}
              .
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={createMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || attaching}>
            {createMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
