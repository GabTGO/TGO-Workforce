import { createFileRoute, Link } from "@tanstack/react-router";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/data/employees";
import {
  useCurrentAccount,
  useUpdateMyPreferences,
  type Theme,
} from "@/lib/session";
import { applyTheme } from "@/lib/theme";
import { ROLE_LABELS } from "@/lib/roles";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TGO Workforce" },
      {
        name: "description",
        content:
          "Your account details and personalization settings for TGO Workforce.",
      },
      { property: "og:title", content: "Profile — TGO Workforce" },
      {
        property: "og:description",
        content: "Account identity and appearance preferences.",
      },
    ],
  }),
  component: ProfilePage,
});

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function ProfilePage() {
  const { data: account, isLoading } = useCurrentAccount();
  const updatePreferences = useUpdateMyPreferences();

  const displayName =
    account?.display_name ||
    [account?.first_name, account?.last_name].filter(Boolean).join(" ") ||
    account?.email ||
    "";

  function setTheme(theme: Theme) {
    applyTheme(theme);
    updatePreferences.mutate(
      { theme },
      {
        onSuccess: () => toast.success(`Switched to ${theme} mode`),
        onError: () => {
          toast.error("Couldn't save your theme preference");
          // The DOM already flipped optimistically — put it back if the save failed.
          if (account) applyTheme(account.theme);
        },
      },
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Profile"
        description="Your account and how TGO Workforce looks for you."
      />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Synced from your Zoho sign-in — update your name or photo there to
            change it here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && account && (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar className="size-16">
                {account.photo_url && (
                  <AvatarImage src={account.photo_url} alt={displayName} />
                )}
                <AvatarFallback className="text-base">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="text-base font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">{account.email}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />{" "}
                    {ROLE_LABELS[account.role]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Last signed in{" "}
                    {formatDate(account.last_login_at ?? undefined)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Personal to your account — this follows you to any device you sign
            in on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                Switch between light and dark mode.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-md border p-1">
              <button
                type="button"
                onClick={() => setTheme("light")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  account?.theme === "light"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  account?.theme === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </button>
            </div>
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Looking for notification and default-office preferences? Those live
            on the{" "}
            <Link
              to="/settings"
              className="font-medium text-primary underline underline-offset-2"
            >
              Settings
            </Link>{" "}
            page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
