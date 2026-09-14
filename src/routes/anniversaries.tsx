import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, CalendarClock, ShieldAlert, Star, Trophy } from "lucide-react";

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
  anniversaries,
  formatDate,
  matchesMilestoneTimeFilter,
  MILESTONE_TIME_FILTER_LABELS,
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

export const Route = createFileRoute("/anniversaries")({
  head: () => ({
    meta: [
      { title: "Work Anniversaries — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Upcoming TGO work anniversaries and tenure milestones by month.",
      },
      {
        property: "og:title",
        content: "Work Anniversaries — Torero Global Outsourcing HR Operations",
      },
      {
        property: "og:description",
        content: "Recognise tenure milestones across TGO delivery hubs.",
      },
    ],
  }),
  component: AnniversariesPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function AnniversariesPage() {
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewMilestones(account?.permissions);
  const employees = useEmployees();
  const [timeFilter, setTimeFilter] = useState<MilestoneTimeFilter>("all");
  const allMilestones = anniversaries(employees);
  const list = allMilestones.filter((e) => matchesMilestoneTimeFilter(e.monthIndex, e.day, timeFilter));
  const months = [...new Set(list.map((e) => e.monthName))];
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const thisMonth = allMilestones.filter((e) => e.monthName === currentMonthName).length;
  const milestoneYears = list.filter((e) => e.years > 0);
  const longestTenure = milestoneYears.reduce((max, e) => Math.max(max, e.years), 0);

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Anniversaries"
          description="Tenure milestones grouped by month for recognition planning."
        />
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Anniversaries"
          description="Tenure milestones grouped by month for recognition planning."
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
        title="Anniversaries"
        description="Tenure milestones grouped by month for recognition planning."
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
        <MetricCard title="Total Milestones" value={list.length} hint="Active employees tracked" icon={Award} />
        <MetricCard
          title="This Month"
          value={thisMonth}
          hint={`Anniversaries in ${currentMonthName}`}
          icon={CalendarClock}
        />
        <MetricCard title="Months Covered" value={months.length} hint="Months with a milestone" icon={Star} />
        <MetricCard
          title="Longest Tenure"
          value={`${longestTenure} yrs`}
          hint="Most years with TGO"
          icon={Trophy}
        />
      </div>
      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Award className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No anniversaries match "{MILESTONE_TIME_FILTER_LABELS[timeFilter]}". Try a wider range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <Card key={month}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-muted-foreground" /> {month}
                </CardTitle>
                <CardDescription>
                  {list.filter((e) => e.monthName === month).length} milestone(s)
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
                        <p className="truncate text-xs text-muted-foreground">
                          {e.monthName} {e.day}, {CURRENT_YEAR} · Joined {formatDate(e.startDate)}
                        </p>
                      </div>
                      <Badge variant="secondary">{e.years} yrs</Badge>
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
