// Shown app-wide (see app-shell.tsx) whenever a Super Admin has an active
// sandbox — a real role switch, not a preview (see backend/app/core/auth.py's
// get_effective_role): nav, pages and every write action are enforced as the
// sandboxed role until "Exit sandbox" is pressed here.

import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useExitSandbox, type AccountProfile } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";

export function SandboxBanner({ account }: { account: AccountProfile }) {
  const exitSandbox = useExitSandbox();

  if (!account.sandbox_role) return null;

  async function handleExit() {
    try {
      await exitSandbox.mutateAsync();
      toast.success("Back to Super Admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't exit sandbox");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0" />
        <span>
          Sandboxing as <strong>{ROLE_LABELS[account.sandbox_role]}</strong> — nav, pages and
          actions are enforced as this role.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-amber-500/40 bg-transparent hover:bg-amber-500/20"
        disabled={exitSandbox.isPending}
        onClick={handleExit}
      >
        Exit sandbox
      </Button>
    </div>
  );
}
