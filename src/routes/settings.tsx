import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OFFICES } from "@/data/employees";
import {
  useCurrentAccount,
  useUpdateMyPreferences,
  type PreferencesPatch,
} from "@/lib/session";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TGO Workforce" },
      {
        name: "description",
        content:
          "Configure workspace defaults and notification preferences for TGO Workforce.",
      },
      { property: "og:title", content: "Settings — TGO Workforce" },
      {
        property: "og:description",
        content:
          "Workspace preferences for the TGO internal operations portal.",
      },
    ],
  }),
  component: SettingsPage,
});

// Sentinel Select value for "no default office" — Radix Select can't take an
// empty string as an item value.
const NO_DEFAULT = "none";

function SettingsPage() {
  const { data: account, isLoading } = useCurrentAccount();
  const updatePreferences = useUpdateMyPreferences();

  const [defaultOffice, setDefaultOffice] = useState<string>(NO_DEFAULT);
  const [notifyAnniversaries, setNotifyAnniversaries] = useState(true);
  const [notifyBirthdays, setNotifyBirthdays] = useState(true);
  const [notifyNewHires, setNotifyNewHires] = useState(true);
  // Seed local form state from the account exactly once — after that, this
  // page's own edits are the source of truth, so a background refetch of
  // /auth/me (the 60s staleTime query other pages also share) can't quietly
  // discard something you're mid-way through changing.
  const seeded = useRef(false);

  useEffect(() => {
    if (!account || seeded.current) return;
    seeded.current = true;
    setDefaultOffice(account.default_office ?? NO_DEFAULT);
    setNotifyAnniversaries(account.notify_anniversaries);
    setNotifyBirthdays(account.notify_birthdays);
    setNotifyNewHires(account.notify_new_hires);
  }, [account]);

  const dirty =
    !!account &&
    (defaultOffice !== (account.default_office ?? NO_DEFAULT) ||
      notifyAnniversaries !== account.notify_anniversaries ||
      notifyBirthdays !== account.notify_birthdays ||
      notifyNewHires !== account.notify_new_hires);

  function handleSave() {
    const patch: PreferencesPatch = {
      default_office: defaultOffice === NO_DEFAULT ? null : defaultOffice,
      notify_anniversaries: notifyAnniversaries,
      notify_birthdays: notifyBirthdays,
      notify_new_hires: notifyNewHires,
    };
    updatePreferences.mutate(patch, {
      onSuccess: () => toast.success("Settings saved"),
      onError: () => toast.error("Couldn't save settings. Please try again."),
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace defaults and notification preferences for your account."
      />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            TGO Workforce — internal operations portal. Your default office
            pre-fills the New Hire form's office picker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Default office</Label>
            <Select
              value={defaultOffice}
              onValueChange={setDefaultOffice}
              disabled={isLoading}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT}>No default</SelectItem>
                {OFFICES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            What your Dashboard surfaces. Turning one off hides the matching
            card there — it only affects your own view, not anyone else's.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              {
                title: "Anniversary reminders",
                desc: "Show upcoming work anniversaries on your Dashboard.",
                checked: notifyAnniversaries,
                onChange: setNotifyAnniversaries,
              },
              {
                title: "Birthday reminders",
                desc: "Show a heads-up on your Dashboard when a birthday falls this week.",
                checked: notifyBirthdays,
                onChange: setNotifyBirthdays,
              },
              {
                title: "New hire alerts",
                desc: "Show recently added employees on your Dashboard.",
                checked: notifyNewHires,
                onChange: setNotifyNewHires,
              },
            ] satisfies {
              title: string;
              desc: string;
              checked: boolean;
              onChange: (v: boolean) => void;
            }[]
          ).map((row, i) => (
            <div key={row.title}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.desc}</p>
                </div>
                <Switch
                  checked={row.checked}
                  onCheckedChange={row.onChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={!dirty || updatePreferences.isPending}
      >
        {updatePreferences.isPending ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}
