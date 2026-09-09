// "Notify" confirmation dialog — sends a preview-then-confirm message to
// Zoho Cliq for a new hire. Ported from the standalone onboarding app's
// src/pages/Dashboard.tsx notify dialog, rebuilt with Workforce's own ui/
// primitives. Message text comes from src/lib/onboarding-notify.ts, which
// this dialog just previews as JSX (bold headers, a check mark per
// completed step) before sending the same string to
// POST /onboarding/notify verbatim.

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Bell, Check, Loader2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import type { NewHire } from "@/data/new-hire-api";
import { useSendCliqNotification } from "@/data/new-hire-store";
import { buildNotifyLines, buildNotifyText } from "@/lib/onboarding-notify";
import { useCurrentAccount } from "@/lib/session";

export function OnboardingNotifyDialog({
  hires,
  initialHire = null,
  trigger,
  onSent,
}: {
  hires: NewHire[];
  initialHire?: NewHire | null;
  trigger: ReactNode;
  onSent?: (hire: NewHire) => void;
}) {
  const { data: account } = useCurrentAccount();
  const sentByLabel = account?.display_name || account?.email || "Unknown user";

  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>(initialHire?.id ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendNotification = useSendCliqNotification();

  useEffect(() => {
    if (open) {
      setTargetId(initialHire?.id ?? "");
      setError(null);
    }
  }, [open, initialHire]);

  const target = hires.find((h) => h.id === targetId) ?? null;
  const lines = target ? buildNotifyLines(target, sentByLabel) : [];

  async function handleSend() {
    if (!target) return;
    setSending(true);
    setError(null);
    try {
      await sendNotification.mutateAsync(buildNotifyText(lines));
      onSent?.(target);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach Cliq — try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && setOpen(next)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Cliq notification</DialogTitle>
          <DialogDescription>
            {target
              ? `This message will be sent to Zoho Cliq for ${target.name}.`
              : "Pick a new hire to preview and send an update for."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="notifyHire" className="text-xs text-muted-foreground">
            New hire
          </Label>
          <select
            id="notifyHire"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="" disabled>
              Select a new hire…
            </option>
            {hires.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.roleTitle ? ` — ${h.roleTitle}` : ""}
              </option>
            ))}
          </select>
        </div>

        {target ? (
          <div className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {lines.map((line, i) => {
              if (line.type === "spacer") return <div key={i} className="h-2" />;
              if (line.type === "step")
                return (
                  <div key={i} className="flex items-center gap-1.5 py-0.5">
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{line.text}</span>
                  </div>
                );
              if (line.type === "header" || line.type === "sentBy")
                return (
                  <p key={i} className="font-semibold">
                    {line.text}
                  </p>
                );
              if (line.type === "stepsHeader")
                return (
                  <p key={i} className={line.text.startsWith("Completed steps") ? "font-semibold" : ""}>
                    {line.text}
                  </p>
                );
              return <p key={i}>{line.text}</p>;
            })}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            Choose a new hire above to preview the message.
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending || !target}>
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
            {sending ? "Sending…" : "Send notification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
