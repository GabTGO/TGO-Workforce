import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Moon, Pencil, ScrollText, ShieldCheck, Sun } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { useMyActivityLogs, type ActivitySeverity } from "@/data/activity-log-store";
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
      { title: "Profile — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content:
          "Your account details and personalization settings for HR Operations.",
      },
      { property: "og:title", content: "Profile — Torero Global Outsourcing HR Operations" },
      {
        property: "og:description",
        content: "Account identity and appearance preferences.",
      },
    ],
  }),
  component: ProfilePage,
});

const SEVERITY_VARIANT: Record<ActivitySeverity, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warning: "outline",
  critical: "destructive",
};

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

function EditProfileDialog({
  displayName,
  photoUrl,
}: {
  displayName: string;
  photoUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [photo, setPhoto] = useState(photoUrl);
  const updatePreferences = useUpdateMyPreferences();

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset to the current saved values every time the dialog opens, so a
      // cancelled edit from last time doesn't linger in the form.
      setName(displayName);
      setPhoto(photoUrl);
    }
    setOpen(next);
  }

  function handleSave() {
    updatePreferences.mutate(
      { display_name: name.trim(), photo_url: photo.trim() || null },
      {
        onSuccess: () => {
          toast.success("Profile updated");
          setOpen(false);
        },
        onError: () => toast.error("Couldn't save your profile. Please try again."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your display name and photo — visible to everyone else in HR Operations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How your name shows up across the portal"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-photo">Photo URL</Label>
            <Input
              id="profile-photo"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              placeholder="https://... (link to an image)"
            />
            <p className="text-xs text-muted-foreground">
              Paste a link to an image — there's no file upload here, just a URL (e.g. a
              Zoho WorkDrive share link or any image already hosted somewhere).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={updatePreferences.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updatePreferences.isPending || !name.trim()}>
            {updatePreferences.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfilePage() {
  const { data: account, isLoading } = useCurrentAccount();
  const updatePreferences = useUpdateMyPreferences();
  const { data: myActivity, isLoading: activityLoading } = useMyActivityLogs(account?.id);

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
        description="Your account and how HR Operations looks for you."
      />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Seeded from your first Zoho sign-in — it's yours to customize from here on.
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
              <EditProfileDialog
                displayName={displayName}
                photoUrl={account.photo_url ?? ""}
              />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            My Activity
          </CardTitle>
          <CardDescription>
            The last things you did across HR Operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {!activityLoading && (myActivity?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet — actions you take (creating a record, changing a
              status, etc.) will show up here.
            </p>
          )}
          {myActivity?.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{log.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {log.target} · {log.timestamp}
                </p>
              </div>
              <Badge variant={SEVERITY_VARIANT[log.severity]} className="shrink-0 capitalize">
                {log.category}
              </Badge>
            </div>
          ))}
          {(myActivity?.length ?? 0) > 0 && (
            <>
              <Separator className="my-1" />
              <Link
                to="/activity-logs"
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                View the full activity log
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
