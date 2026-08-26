import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TGO Workforce" },
      {
        name: "description",
        content: "Configure workspace defaults, notifications and data retention for TGO Workforce.",
      },
      { property: "og:title", content: "Settings — TGO Workforce" },
      {
        property: "og:description",
        content: "Workspace preferences for the TGO internal operations portal.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Workspace preferences and portal configuration." />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>General details for this internal portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" defaultValue="TGO Workforce" />
          </div>
          <div className="grid gap-2">
            <Label>Default office</Label>
            <Select defaultValue={OFFICES[0]}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
          <CardDescription>Automated reminders for people operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["Anniversary reminders", "Weekly digest of upcoming tenure milestones."],
            ["Birthday reminders", "Daily morning notice for celebrations."],
            ["New hire alerts", "Notify hub leads when onboarding is submitted."],
          ].map(([title, desc], i) => (
            <div key={title}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => toast.success("Settings saved")}>Save changes</Button>
    </div>
  );
}
