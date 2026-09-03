import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  UserMinus,
  UserPlus,
  LogOut,
  Building2,
  Globe2,
  ArrowRight,
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
import { useEmployees } from "@/data/employee-store";
import { anniversaries, formatDate, metrics, officeDistribution } from "@/data/employees";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TGO Workforce Portal" },
      {
        name: "description",
        content:
          "Operational snapshot of TGO Workforce: active headcount, new hires, exits and hub distribution.",
      },
      { property: "og:title", content: "Dashboard — TGO Workforce Portal" },
      {
        property: "og:description",
        content: "Live workforce metrics for TGO automation and AI operations teams.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const employees = useEmployees();
  const m = metrics(employees);
  const dist = officeDistribution(employees);
  const total = dist.reduce((sum, d) => sum + d.active + d.inactive, 0);
  const upcoming = anniversaries(employees).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Operational snapshot across all TGO delivery hubs."
        action={
          <div className="flex items-center gap-2">
            <ImportEmployeesDialog />
            <Button asChild size="sm" variant="outline">
              <Link to="/directory">
                Open directory <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Active Employees" value={m.active} hint="Currently employed" icon={Users} />
        <MetricCard title="Inactive Employees" value={m.inactive} hint="Resigned or terminated" icon={UserMinus} />
        <MetricCard title="New Hires" value={m.newHires} hint="Started in last 12 months" icon={UserPlus} />
        <MetricCard title="Exits" value={m.exits} hint="Departures in last 12 months" icon={LogOut} />
        <MetricCard title="PH Eastwood (Active)" value={m.eastwood} hint="Manila delivery hub" icon={Building2} />
        <MetricCard title="CO Medellin (Active)" value={m.medellin} hint="LATAM delivery hub" icon={Globe2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeadcountTrendChart employees={employees} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Hub Utilisation</CardTitle>
            <CardDescription>Share of total workforce per office</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dist.map((d) => {
              const pct = total ? Math.round(((d.active + d.inactive) / total) * 100) : 0;
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent New Hires</CardTitle>
            <CardDescription>Latest additions to the workforce</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.newHireList.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
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
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
            <CardDescription>Work anniversaries to recognise</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.monthName} {e.day} · {e.department}
                  </p>
                </div>
                <Badge variant="secondary">{e.years} yrs</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
