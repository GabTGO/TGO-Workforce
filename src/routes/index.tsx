import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  UserMinus,
  UserPlus,
  LogOut,
  Building2,
  Globe2,
  ArrowRight,
  Cake,
  ClipboardCheck,
  ShieldAlert,
  Send,
  CircleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { ImportEmployeesDialog } from "@/components/import-employees-dialog";
import { MetricCard } from "@/components/metric-card";
import { HeadcountTrendChart } from "@/components/workforce-charts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEmployees } from "@/data/employee-store";
import {
  anniversaries,
  formatDate,
  metrics,
  officeDistribution,
  tenureDays,
  upcomingBirthdays,
} from "@/data/employees";
import { computeStatus } from "@/data/new-hire-api";
import { useNewHires } from "@/data/new-hire-store";
import { useViolationsQuery } from "@/data/violation-store";
import { useCurrentAccount } from "@/lib/session";
import {
  canManageEmployees,
  canViewAttendance,
  canViewEmployees,
  canViewMilestones,
  canViewOnboarding,
  getEffectiveRole,
  isFullAccessRole,
} from "@/lib/permissions";

// Whether a month/day (as returned by upcomingBirthdays) falls within the
// next 7 days, wrapping into next year for a birthday that's already passed
// this year's date — backs the "Birthday reminders" toggle on Settings.
function isWithinNextWeek(monthIndex: number, day: number): boolean {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  let next = new Date(now.getFullYear(), monthIndex, day);
  if (next < startOfToday)
    next = new Date(now.getFullYear() + 1, monthIndex, day);
  const diffDays = (next.getTime() - startOfToday.getTime()) / 86_400_000;
  return diffDays >= 0 && diffDays < 7;
}

// How many days ago a recurring month/day (birthday, anniversary) last
// occurred — rolls back a year when this year's date hasn't happened yet, so
// e.g. a Jan 5 birthday checked in December still reads as "~330 days ago"
// rather than a negative, still-upcoming number. Backs the Dashboard's
// "last 30 days" milestone cards below.
function daysSinceLastOccurrence(monthIndex: number, day: number): number {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let occurrence = new Date(now.getFullYear(), monthIndex, day);
  if (occurrence > startOfToday) occurrence = new Date(now.getFullYear() - 1, monthIndex, day);
  return Math.round((startOfToday.getTime() - occurrence.getTime()) / 86_400_000);
}

const RECENT_MILESTONE_DAYS = 30;
const RECENT_HIRE_DAYS = 14;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content:
          "Operational snapshot across every HR Operations module: headcount, onboarding progress, attendance violations and hub distribution.",
      },
      { property: "og:title", content: "Dashboard — Torero Global Outsourcing HR Operations" },
      {
        property: "og:description",
        content:
          "Live workforce metrics for TGO automation and AI operations teams.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const employees = useEmployees();
  const { data: account } = useCurrentAccount();
  // The full cross-office "everything" overview (company-wide headcount,
  // hub distribution, recent hires across the whole workforce) is Admin/
  // Super Admin only — everyone else gets a dashboard scoped to just the
  // module(s) their own permissions actually cover (see the Onboarding/
  // Attendance/Employees snapshot cards below), same as the sidebar and
  // every other page in the app.
  const isFullAccess = isFullAccessRole(getEffectiveRole(account));
  const canManage = canManageEmployees(account?.permissions);
  const canViewEmployeesModule = canViewEmployees(account?.permissions);
  const canViewOnboardingModule = canViewOnboarding(account?.permissions);
  const canViewAttendanceModule = canViewAttendance(account?.permissions);
  const m = metrics(employees);
  const dist = officeDistribution(employees);
  const total = dist.reduce((sum, d) => sum + d.active + d.inactive, 0);
  const birthdaysThisWeek = upcomingBirthdays(employees).filter((e) =>
    isWithinNextWeek(e.monthIndex, e.day),
  );

  // Dashboard "recent activity" windows: milestones (birthdays,
  // anniversaries) that occurred in the last 30 days, and new hires who
  // started in the last 14 — recently-happened events worth a recap, not an
  // indefinite backlog. Sorted most-recent-first (ascending days-ago).
  const recentAnniversaries = anniversaries(employees)
    .map((e) => ({ ...e, daysAgo: daysSinceLastOccurrence(e.monthIndex, e.day) }))
    .filter((e) => e.daysAgo <= RECENT_MILESTONE_DAYS)
    .sort((a, b) => a.daysAgo - b.daysAgo);
  const recentBirthdays = upcomingBirthdays(employees)
    .map((e) => ({ ...e, daysAgo: daysSinceLastOccurrence(e.monthIndex, e.day) }))
    .filter((e) => e.daysAgo <= RECENT_MILESTONE_DAYS)
    .sort((a, b) => a.daysAgo - b.daysAgo);
  const recentNewHires = employees
    .filter((e) => e.status === "Active" && tenureDays(e.startDate) <= RECENT_HIRE_DAYS)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  // Cross-module snapshot — every signed-in role sees this, same as every
  // other read in the app (reads stay open across modules; only writes and
  // the deep-dive Analytics page are role/admin-gated). This is the "one
  // dashboard" home view: a person whose role only lets them *manage* one
  // module can still see at a glance what's happening in the others.
  const newHires = useNewHires(canViewOnboardingModule);
  const onboardingStats = {
    total: newHires.length,
    complete: newHires.filter((h) => computeStatus(h) === "Complete").length,
    inProgress: newHires.filter((h) => computeStatus(h) === "In Progress").length,
  };

  const { data: violationsPage } = useViolationsQuery({}, 0, 500, canViewAttendanceModule);
  const violations = violationsPage?.items ?? [];
  const violationStats = {
    total: violationsPage?.total ?? violations.length,
    pending: violations.filter(
      (v) => !["Sent", "Failed"].includes(v.emailStatus),
    ).length,
    sent: violations.filter((v) => v.emailStatus === "Sent").length,
    failed: violations.filter((v) => v.emailStatus === "Failed").length,
  };

  // Personalization from Settings — each person's Dashboard only shows the
  // cards they've asked to see. Default to shown while the account is still
  // loading, so there's no flash of an empty dashboard.
  const canViewMilestonesModule = canViewMilestones(account?.permissions);
  // "Recent New Hires" is a company-wide list (every office, every
  // department) — part of the Admin/Super Admin overview, not a
  // module-scoped card, so it stays with the rest of that section.
  const showNewHires = isFullAccess && (account?.notify_new_hires ?? true);
  const showAnniversaries = canViewMilestonesModule && (account?.notify_anniversaries ?? true);
  const showBirthdaysCard = canViewMilestonesModule && (account?.notify_birthdays ?? true);
  const showBirthdayBanner = showBirthdaysCard && birthdaysThisWeek.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          isFullAccess
            ? "Operational snapshot across all TGO delivery hubs."
            : "Snapshot of the modules available to your role."
        }
        action={
          <div className="flex items-center gap-2">
            {canManage && <ImportEmployeesDialog />}
            <Button asChild size="sm" variant="outline">
              <Link to="/directory">
                Open directory <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {showBirthdayBanner && (
        <Alert>
          <Cake className="h-4 w-4" />
          <AlertTitle>
            {birthdaysThisWeek.length} birthday
            {birthdaysThisWeek.length === 1 ? "" : "s"} this week
          </AlertTitle>
          <AlertDescription>
            {birthdaysThisWeek
              .slice(0, 4)
              .map((e) => `${e.name} (${e.monthName} ${e.day})`)
              .join(", ")}
            {birthdaysThisWeek.length > 4 &&
              ` and ${birthdaysThisWeek.length - 4} more`}
            . Turn this off on the Settings page.
          </AlertDescription>
        </Alert>
      )}

      {isFullAccess && (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Active Employees"
          value={m.active}
          hint="Currently employed"
          icon={Users}
        />
        <MetricCard
          title="Inactive Employees"
          value={m.inactive}
          hint="Resigned or terminated"
          icon={UserMinus}
        />
        <MetricCard
          title="New Hires"
          value={m.newHires}
          hint="Started in last 12 months"
          icon={UserPlus}
        />
        <MetricCard
          title="Exits"
          value={m.exits}
          hint="Departures in last 12 months"
          icon={LogOut}
        />
        <MetricCard
          title="PH Eastwood (Active)"
          value={m.eastwood}
          hint="Manila delivery hub"
          icon={Building2}
        />
        <MetricCard
          title="CO Medellin (Active)"
          value={m.medellin}
          hint="LATAM delivery hub"
          icon={Globe2}
        />
      </div>
      )}

      {(isFullAccess && (canViewOnboardingModule || canViewAttendanceModule)) ||
      (!isFullAccess && (canViewEmployeesModule || canViewOnboardingModule || canViewAttendanceModule)) ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!isFullAccess && canViewEmployeesModule && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Employees Snapshot
                </CardTitle>
                <CardDescription>Headcount at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-semibold">{m.active}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{m.inactive}</p>
                    <p className="text-xs text-muted-foreground">Inactive</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{m.newHires}</p>
                    <p className="text-xs text-muted-foreground">New Hires</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/directory">
                    Open directory <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canViewOnboardingModule && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  Onboarding Snapshot
                </CardTitle>
                <CardDescription>New hires moving through the checklist</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-semibold">{onboardingStats.total}</p>
                    <p className="text-xs text-muted-foreground">Tracked</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{onboardingStats.inProgress}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{onboardingStats.complete}</p>
                    <p className="text-xs text-muted-foreground">Complete</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/onboarding">
                    Open onboarding <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {canViewAttendanceModule && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  Attendance Snapshot
                </CardTitle>
                <CardDescription>Violation records across every status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-semibold">{violationStats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1 text-2xl font-semibold">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      {violationStats.sent}
                    </p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1 text-2xl font-semibold">
                      {violationStats.failed > 0 && (
                        <CircleAlert className="h-4 w-4 text-destructive" />
                      )}
                      {violationStats.failed}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/attendance-violations">
                    Open attendance <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {isFullAccess && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeadcountTrendChart employees={employees} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Hub Utilisation</CardTitle>
              <CardDescription>
                Share of total workforce per office
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dist.map((d) => {
                const pct = total
                  ? Math.round(((d.active + d.inactive) / total) * 100)
                  : 0;
                return (
                  <div key={d.office} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>{d.office}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {(showNewHires || showAnniversaries || showBirthdaysCard) && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {showNewHires && (
            <Card>
              <CardHeader>
                <CardTitle>Recent New Hires</CardTitle>
                <CardDescription>Started in the last {RECENT_HIRE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentNewHires.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No new hires in the last {RECENT_HIRE_DAYS} days.
                  </p>
                ) : (
                  recentNewHires.slice(0, 5).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.position} · {e.office}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(e.startDate)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {showAnniversaries && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Anniversaries</CardTitle>
                <CardDescription>Work anniversaries in the last {RECENT_MILESTONE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentAnniversaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No anniversaries in the last {RECENT_MILESTONE_DAYS} days.
                  </p>
                ) : (
                  recentAnniversaries.slice(0, 5).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.monthName} {e.day} · {e.department}
                        </p>
                      </div>
                      <Badge variant="secondary">{e.years} yrs</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {showBirthdaysCard && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Birthdays</CardTitle>
                <CardDescription>Celebrations in the last {RECENT_MILESTONE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentBirthdays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No birthdays in the last {RECENT_MILESTONE_DAYS} days.
                  </p>
                ) : (
                  recentBirthdays.slice(0, 5).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.office}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {e.monthName.slice(0, 3)} {e.day}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
