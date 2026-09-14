import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  UserMinus,
  UserPlus,
  UserX,
  LogOut,
  Building2,
  Globe2,
  ArrowRight,
  Award,
  Cake,
  ClipboardCheck,
  ShieldAlert,
  Send,
  CircleAlert,
  Trophy,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { ImportEmployeesDialog } from "@/components/import-employees-dialog";
import { MetricCard } from "@/components/metric-card";
import { HeadcountTrendChart } from "@/components/workforce-charts";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAwards } from "@/data/award-store";
import { useEmployees } from "@/data/employee-store";
import {
  anniversaries,
  daysSinceLastOccurrence,
  formatDate,
  metrics,
  officeDistribution,
  parseCalendarDate,
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
  canViewAwards,
  canViewEmployees,
  canViewMilestones,
  canViewOnboarding,
  getEffectiveRole,
  isFullAccessRole,
} from "@/lib/permissions";

const RECENT_MILESTONE_DAYS = 30;
const RECENT_HIRE_DAYS = 14;
// Rows within this many days get a highlighted background in the detailed
// tables below — "just happened", worth the eye going there first.
const SOON_THRESHOLD_DAYS = 3;

const EXIT_STATUS_VARIANT: Record<string, "secondary" | "destructive"> = {
  Resigned: "secondary",
  Terminated: "destructive",
};

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
  const canViewAwardsModule = canViewAwards(account?.permissions);
  const m = metrics(employees);
  const dist = officeDistribution(employees);
  const total = dist.reduce((sum, d) => sum + d.active + d.inactive, 0);
  const resignedCount = employees.filter((e) => e.status === "Resigned").length;
  const terminatedCount = employees.filter((e) => e.status === "Terminated").length;

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
  const recentExits = employees
    .flatMap((e) => {
      if (!e.exitDate) return [];
      const daysAgo = Math.round((Date.now() - parseCalendarDate(e.exitDate).getTime()) / 86_400_000);
      return daysAgo >= 0 && daysAgo <= RECENT_MILESTONE_DAYS ? [{ ...e, daysAgo }] : [];
    })
    .sort((a, b) => a.daysAgo - b.daysAgo);

  const awards = useAwards(canViewAwardsModule);
  const recentAwards = awards
    .flatMap((a) => {
      const daysAgo = Math.round((Date.now() - parseCalendarDate(a.awardedDate).getTime()) / 86_400_000);
      return daysAgo >= 0 && daysAgo <= RECENT_MILESTONE_DAYS ? [{ ...a, daysAgo }] : [];
    })
    .sort((a, b) => a.daysAgo - b.daysAgo);

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
  const showAwardsCard = canViewAwardsModule;

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

      {(showNewHires || showAnniversaries || showBirthdaysCard || showAwardsCard) && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {showNewHires && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  New Hires ({RECENT_HIRE_DAYS} days)
                </CardTitle>
                <CardDescription>Started in the last {RECENT_HIRE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto p-0">
                {recentNewHires.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No new hires in the last {RECENT_HIRE_DAYS} days.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead className="text-right">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentNewHires.map((e) => {
                        const daysAgo = tenureDays(e.startDate);
                        return (
                          <TableRow key={e.id} className={daysAgo <= SOON_THRESHOLD_DAYS ? "bg-amber-500/5" : undefined}>
                            <TableCell className="font-medium">{e.name}</TableCell>
                            <TableCell className="text-muted-foreground">{e.office}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatDate(e.startDate)}
                              <span className="ml-1.5 text-xs">
                                ({daysAgo === 0 ? "today" : `${daysAgo}d ago`})
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {showAnniversaries && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  Anniversaries ({RECENT_MILESTONE_DAYS} days)
                </CardTitle>
                <CardDescription>Work anniversaries in the last {RECENT_MILESTONE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto p-0">
                {recentAnniversaries.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No anniversaries in the last {RECENT_MILESTONE_DAYS} days.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Years</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAnniversaries.map((e) => (
                        <TableRow key={e.id} className={e.daysAgo <= SOON_THRESHOLD_DAYS ? "bg-amber-500/5" : undefined}>
                          <TableCell>
                            <p className="font-medium">{e.name}</p>
                            <p className="text-xs text-muted-foreground">{e.department}</p>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {e.monthName} {e.day}
                            <span className="ml-1.5 text-xs">
                              ({e.daysAgo === 0 ? "today" : `${e.daysAgo}d ago`})
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{e.years} yrs</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {showBirthdaysCard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cake className="h-4 w-4 text-muted-foreground" />
                  Birthdays ({RECENT_MILESTONE_DAYS} days)
                </CardTitle>
                <CardDescription>Celebrations in the last {RECENT_MILESTONE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto p-0">
                {recentBirthdays.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No birthdays in the last {RECENT_MILESTONE_DAYS} days.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBirthdays.map((e) => (
                        <TableRow key={e.id} className={e.daysAgo <= SOON_THRESHOLD_DAYS ? "bg-amber-500/5" : undefined}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell className="text-muted-foreground">{e.office}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {e.monthName.slice(0, 3)} {e.day}
                            <span className="ml-1.5 text-xs">
                              ({e.daysAgo === 0 ? "today" : `${e.daysAgo}d ago`})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {showAwardsCard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Awards ({RECENT_MILESTONE_DAYS} days)
                </CardTitle>
                <CardDescription>Recognition given in the last {RECENT_MILESTONE_DAYS} days</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto p-0">
                {recentAwards.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No awards given in the last {RECENT_MILESTONE_DAYS} days.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Award</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAwards.map((a) => (
                        <TableRow key={a.id} className={a.daysAgo <= SOON_THRESHOLD_DAYS ? "bg-amber-500/5" : undefined}>
                          <TableCell>
                            <p className="font-medium">{a.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{a.employeeOffice}</p>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{a.title}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDate(a.awardedDate)}
                            <span className="ml-1.5 text-xs">
                              ({a.daysAgo === 0 ? "today" : `${a.daysAgo}d ago`})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isFullAccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Exits in the Last {RECENT_MILESTONE_DAYS} Days
            </CardTitle>
            <CardDescription>Departures across every hub, most recent first</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentExits.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No departures in the last {RECENT_MILESTONE_DAYS} days.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Exit Date</TableHead>
                      <TableHead className="text-right">Days Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentExits.map((e) => (
                      <TableRow key={e.id} className={e.daysAgo <= SOON_THRESHOLD_DAYS ? "bg-amber-500/5" : undefined}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>
                          <Badge variant={EXIT_STATUS_VARIANT[e.status] ?? "secondary"}>{e.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.office}</TableCell>
                        <TableCell className="text-muted-foreground">{e.department}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(e.exitDate)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {e.daysAgo === 0 ? "today" : `${e.daysAgo} days`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isFullAccess && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          title="Active Employees"
          value={m.active}
          hint="Currently employed"
          icon={Users}
        />
        <MetricCard
          title="Resigned"
          value={resignedCount}
          hint="Voluntarily left"
          icon={UserMinus}
        />
        <MetricCard
          title="Terminated"
          value={terminatedCount}
          hint="Involuntarily separated"
          icon={UserX}
        />
        <MetricCard
          title="New Hires"
          value={recentNewHires.length}
          hint={`Started in last ${RECENT_HIRE_DAYS} days`}
          icon={UserPlus}
        />
        <MetricCard
          title="Exits"
          value={recentExits.length}
          hint={`Departures in last ${RECENT_MILESTONE_DAYS} days`}
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
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-semibold">{m.active}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{resignedCount}</p>
                    <p className="text-xs text-muted-foreground">Resigned</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{terminatedCount}</p>
                    <p className="text-xs text-muted-foreground">Terminated</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{recentNewHires.length}</p>
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
    </div>
  );
}
