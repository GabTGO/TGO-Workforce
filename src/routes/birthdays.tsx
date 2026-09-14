import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Cake, CalendarClock, Globe2, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  matchesMilestoneTimeFilter,
  MILESTONE_TIME_FILTER_LABELS,
  upcomingBirthdays,
  type MilestoneTimeFilter,
} from "@/data/employees";
import { useEmployees } from "@/data/employee-store";
import { canViewMilestones } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { useCurrentAccount } from "@/lib/session";

const TIME_FILTERS: MilestoneTimeFilter[] = [
  "all",
  "this-month",
  "last-7",
  "next-7",
  "last-30",
  "next-30",
];

const CURRENT_YEAR = new Date().getFullYear();

export const Route = createFileRoute("/birthdays")({
  head: () => ({
    meta: [
      { title: "Birthdays — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Employee birthday calendar for TGO teams, grouped by month.",
      },
      { property: "og:title", content: "Birthdays — Torero Global Outsourcing HR Operations" },
      {
        property: "og:description",
        content: "Plan celebrations with the TGO employee birthday calendar.",
      },
    ],
  }),
  component: BirthdaysPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function BirthdaysPage() {
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewMilestones(account?.permissions);
  const employees = useEmployees();
  const [timeFilter, setTimeFilter] = useState<MilestoneTimeFilter>("all");
  const allBirthdays = upcomingBirthdays(employees);
  const list = allBirthdays.filter((e) => matchesMilestoneTimeFilter(e.monthIndex, e.day, timeFilter));
  const months = [...new Set(list.map((e) => e.monthName))];
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const thisMonth = allBirthdays.filter((e) => e.monthName === currentMonthName).length;
  const eastwood = list.filter((e) => e.office === "PH Eastwood").length;
  const medellin = list.filter((e) => e.office === "CO Medellin").length;

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Birthdays"
          description="Birthday calendar for active employees across all hubs."
        />
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Birthdays"
          description="Birthday calendar for active employees across all hubs."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No access</p>
              <p className="text-sm text-muted-foreground">
                Your account ({account ? ROLE_LABELS[account.role] : "signed out"}) doesn't have
                access to Milestones. Ask a Super Admin to grant it from the permission matrix on
                User Management if you need it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Birthdays"
        description="Birthday calendar for active employees across all hubs."
        action={
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as MilestoneTimeFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {MILESTONE_TIME_FILTER_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Birthdays" value={list.length} hint="Active employees tracked" icon={Cake} />
        <MetricCard
          title="This Month"
          value={thisMonth}
          hint={`Celebrations in ${currentMonthName}`}
          icon={CalendarClock}
        />
        <MetricCard title="PH Eastwood" value={eastwood} hint="Manila delivery hub" icon={Building2} />
        <MetricCard title="CO Medellin" value={medellin} hint="LATAM delivery hub" icon={Globe2} />
      </div>
      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Cake className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No birthdays match "{MILESTONE_TIME_FILTER_LABELS[timeFilter]}". Try a wider range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <Card key={month}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cake className="h-4 w-4 text-muted-foreground" /> {month}
                </CardTitle>
                <CardDescription>
                  {list.filter((e) => e.monthName === month).length} celebration(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {list
                  .filter((e) => e.monthName === month)
                  .map((e) => (
                    <div key={e.id} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials(e.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.office}</p>
                      </div>
                      <Badge variant="outline">
                        {e.monthName.slice(0, 3)} {e.day}, {CURRENT_YEAR}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
