import { useRef, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, KeyRound, Moon, Pencil, ScrollText, ShieldCheck, Sun, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useCurrentAccount, useUpdateMyPreferences, type Theme } from "@/lib/session";
import { applyTheme } from "@/lib/theme";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";

// Keeps an uploaded photo (there's no object storage — see the comment on
// backend/app/models/account.py's Account.photo_url) small enough to store
// inline as a data: URI instead of a full-resolution image.
const MAX_PHOTO_DIMENSION = 256;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function readAndResizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error("That image is too large (max 8MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't process that image."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Your account details and personalization settings for HR Operations.",
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

function EditProfileDialog({ displayName, photoUrl }: { displayName: string; photoUrl: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [photo, setPhoto] = useState(photoUrl);
  const [processingFile, setProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // clear so picking the exact same file again still fires onChange
    if (!file) return;
    setProcessingFile(true);
    try {
      setPhoto(await readAndResizeImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't process that image.");
    } finally {
      setProcessingFile(false);
    }
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

  const isUploadedPhoto = photo.startsWith("data:");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> Personalize
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalize your profile</DialogTitle>
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
            <Label>Profile photo</Label>
            <div className="flex items-start gap-3">
              <Avatar className="size-14 shrink-0">
                {photo && <AvatarImage src={photo} alt={name} />}
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Input
                  id="profile-photo"
                  value={isUploadedPhoto ? "" : photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  placeholder={
                    isUploadedPhoto
                      ? "Uploaded photo — remove it to paste a URL instead"
                      : "https://... (link to an image)"
                  }
                  disabled={isUploadedPhoto}
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={processingFile}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {processingFile ? "Processing…" : "Upload a file"}
                  </Button>
                  {photo && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto("")}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a link to an image, or upload one from your device — an uploaded photo is
              resized to a small thumbnail and stored with your account.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updatePreferences.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePreferences.isPending || processingFile || !name.trim()}
          >
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
      <PageHeader title="Profile" description="Your account and how HR Operations looks for you." />

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
                {account.photo_url && <AvatarImage src={account.photo_url} alt={displayName} />}
                <AvatarFallback className="text-base">{initials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="text-base font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">{account.email}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> {ROLE_LABELS[account.role]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Last signed in {formatDate(account.last_login_at ?? undefined)}
                  </span>
                </div>
              </div>
              <EditProfileDialog displayName={displayName} photoUrl={account.photo_url ?? ""} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Personal to your account — this follows you to any device you sign in on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark mode.</p>
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
            Looking for notification and default-office preferences? Those live on the{" "}
            <Link to="/settings" className="font-medium text-primary underline underline-offset-2">
              Settings
            </Link>{" "}
            page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            My Permissions
          </CardTitle>
          <CardDescription>
            What your role{account ? ` (${ROLE_LABELS[account.role]})` : ""} lets you do across HR
            Operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (account?.permissions.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Your role doesn't currently hold any permissions.
            </p>
          )}
          {account?.permissions.map((perm) => {
            const label = PERMISSION_LABELS[perm];
            return (
              <div key={perm} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-medium">{label.title}</p>
                  <p className="text-xs text-muted-foreground">{label.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            My Activity
          </CardTitle>
          <CardDescription>The last things you did across HR Operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!activityLoading && (myActivity?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet — actions you take (creating a record, changing a status, etc.)
              will show up here.
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
