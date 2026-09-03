import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import {
  useCurrentAccount,
  useUpdateMyPreferences,
  type Theme,
} from "@/lib/session";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("light");
  const { data: account } = useCurrentAccount();
  const updatePreferences = useUpdateMyPreferences();
  // Runs the "adopt the account's saved theme" reconciliation exactly once —
  // after that, this tab's own toggling is the source of truth again, so a
  // background refetch of /auth/me doesn't fight the person's own click.
  const syncedFromAccount = useRef(false);

  // Instant paint from whatever was last applied locally, before the account
  // preference (which may say otherwise) has had a chance to load.
  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  // The server's preference is the source of truth once it's available —
  // that's what makes a theme choice follow someone to a new device instead
  // of being stuck to whichever browser they set it in last.
  useEffect(() => {
    if (!account || syncedFromAccount.current) return;
    syncedFromAccount.current = true;
    if (account.theme !== theme) {
      setThemeState(account.theme);
      applyTheme(account.theme);
    }
  }, [account, theme]);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      updatePreferences.mutate(
        { theme: next },
        {
          onError: () => toast.error("Couldn't save your theme preference"),
        },
      );
      return next;
    });
  }, [updatePreferences]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}
