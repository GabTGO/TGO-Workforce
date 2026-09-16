// The chat-style reply thread on one Feedback card — only reachable for the
// card's own reporter or a Super Admin (feedback.tsx only renders the "View
// Thread" trigger for those two cases, and the backend independently 404s
// anyone else who tries the endpoint directly — see
// app/api/routes/feedback.py's _can_access_thread).

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { ImagePlus, Loader2, MessageCircle, SendHorizontal, SmilePlus, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { Feedback, FeedbackComment } from "@/data/feedback-api";
import {
  useCreateFeedbackComment,
  useFeedbackCommentsQuery,
  useToggleFeedbackCommentReaction,
} from "@/data/feedback-store";
import { downscaleImage } from "@/lib/image-attachments";
import { ROLE_LABELS } from "@/lib/roles";

// A small fixed palette rather than a full emoji picker — this is a
// lightweight "react to proof/report" gesture, not general chat.
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🎉", "👀"];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay
    ? time
    : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function ReactionBar({
  comment,
  onToggle,
  disabled,
}: {
  comment: FeedbackComment;
  onToggle: (emoji: string) => void;
  disabled: boolean;
}) {
  const activeEntries = Object.entries(comment.reactionCounts).filter(([, count]) => count > 0);

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      {activeEntries.map(([emoji, count]) => {
        const mine = comment.myReactions.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(emoji)}
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
              mine
                ? "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Add reaction"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" align="start">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggle(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-base hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FeedbackThreadDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Feedback;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: comments, isLoading, isError } = useFeedbackCommentsQuery(item.id, open);
  const createMutation = useCreateFeedbackComment(item.id);
  const toggleReactionMutation = useToggleFeedbackCommentReaction(item.id);

  const [message, setMessage] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setMessage("");
      setPendingImage(null);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [comments?.length]);

  async function attachFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images can be attached here.");
      return;
    }
    try {
      const dataUrl = await downscaleImage(file);
      setPendingImage(dataUrl);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't read that image. Try a different file.");
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((i) => i.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    void attachFile(file);
  }

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed && !pendingImage) {
      toast.error("Write a message or attach an image first.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        message: trimmed || undefined,
        imageData: pendingImage || undefined,
      });
      setMessage("");
      setPendingImage(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't send that. Please try again.");
    }
  }

  function handleToggleReaction(commentId: string, emoji: string) {
    toggleReactionMutation.mutate({ commentId, emoji });
  }

  const items = comments ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            {item.title}
          </DialogTitle>
          <DialogDescription>Only you and Super Admin can see this thread.</DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading conversation…</p>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Couldn't load this thread. Try again.
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No replies yet — start the conversation.
            </p>
          ) : (
            items.map((comment) => {
              return (
                <div
                  key={comment.id}
                  className="flex animate-in gap-2.5 fade-in slide-in-from-bottom-2 duration-300"
                >
                  <Avatar className="mt-0.5 size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {initials(comment.authorLabel)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-sm font-medium">{comment.authorLabel}</span>
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                        {ROLE_LABELS[comment.authorRole]}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    {comment.message && (
                      <p className="whitespace-pre-wrap break-words rounded-lg rounded-tl-sm bg-muted/60 px-3 py-2 text-sm">
                        {comment.message}
                      </p>
                    )}
                    {comment.imageData && (
                      <img
                        src={comment.imageData}
                        alt="Attached screenshot"
                        className="max-h-64 max-w-full rounded-lg border object-contain"
                      />
                    )}
                    <ReactionBar
                      comment={comment}
                      onToggle={(emoji) => handleToggleReaction(comment.id, emoji)}
                      disabled={toggleReactionMutation.isPending}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          {pendingImage && (
            <div className="relative inline-block">
              <img
                src={pendingImage}
                alt="Attachment preview"
                className="h-20 rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void attachFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Reply, or paste a screenshot (Ctrl+V)…"
              rows={1}
              className="min-h-9 flex-1 resize-none"
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0"
              onClick={handleSend}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
