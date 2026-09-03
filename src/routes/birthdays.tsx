import { createFileRoute } from "@tanstack/react-router";
import { Building2, Cake, CalendarClock, Globe2 } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { upcomingBirthdays } from "@/data/employees";
import { useEmployees } from "@/data/employee-store";

export const Route = createFileRoute("/birthdays")({
  head: () => ({
    meta: [
      { title: "Birthdays — TGO Workforce" },
      {
        name: "description",
        content: "Employee birthday calendar for TGO teams, grouped by month.",
      },
      { property: "og:title", content: "Birthdays — TGO Workforce" },
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
  const employees = useEmployees();
  const list = upcomingBirthdays(employees);
  const months = [...new Set(list.map((e) => e.monthName))];
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const thisMonth = list.filter((e) => e.monthName === currentMonthName).length;
  const eastwood = list.filter((e) => e.office === "PH Eastwood").length;
  const medellin = list.filter((e) => e.office === "CO Medellin").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Birthdays"
        description="Birthday calendar for active employees across all hubs."
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
                      {e.monthName.slice(0, 3)} {e.day}
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
