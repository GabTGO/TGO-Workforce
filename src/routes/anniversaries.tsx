import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { anniversaries, formatDate } from "@/data/employees";

export const Route = createFileRoute("/anniversaries")({
  head: () => ({
    meta: [
      { title: "Work Anniversaries — TGO Workforce" },
      {
        name: "description",
        content: "Upcoming TGO work anniversaries and tenure milestones by month.",
      },
      { property: "og:title", content: "Work Anniversaries — TGO Workforce" },
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
  const list = anniversaries();
  const months = [...new Set(list.map((e) => e.monthName))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anniversaries"
        description="Tenure milestones grouped by month for recognition planning."
      />
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
                        Joined {formatDate(e.startDate)}
                      </p>
                    </div>
                    <Badge variant="secondary">{e.years} yrs</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
