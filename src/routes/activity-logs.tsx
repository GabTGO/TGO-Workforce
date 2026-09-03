import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, Info, Search, ScrollText } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActivityLogs, type ActivitySeverity } from "@/data/activity-log-store";

const SEVERITY_VARIANT: Record<ActivitySeverity, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warning: "outline",
  critical: "destructive",
};

export const Route = createFileRoute("/activity-logs")({
  head: () => ({
    meta: [
      { title: "Activity Logs — TGO Workforce" },
      {
        name: "description",
        content:
          "Audit trail of employee record changes, access events, data exports and system jobs in TGO Workforce.",
      },
      { property: "og:title", content: "Activity Logs — TGO Workforce" },
      {
        property: "og:description",
        content: "Track who changed what across the TGO internal operations portal.",
      },
    ],
  }),
  component: ActivityLogsPage,
});

function ActivityLogsPage() {
  const { data, isLoading, isError } = useActivityLogs();
  const logs = data ?? [];

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesQuery =
        !q ||
        [log.id, log.actor, log.action, log.target].some((v) => v.toLowerCase().includes(q));
      const matchesCategory = category === "all" || log.category === category;
      const matchesSeverity = severity === "all" || log.severity === severity;
      return matchesQuery && matchesCategory && matchesSeverity;
    });
  }, [logs, query, category, severity]);

  const critical = logs.filter((l) => l.severity === "critical").length;
  const warning = logs.filter((l) => l.severity === "warning").length;
  const info = logs.filter((l) => l.severity === "info").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Audit trail of record changes, access events, data exports and system jobs."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Events"
          value={logs.length}
          hint="All recorded events"
          icon={ScrollText}
        />
        <MetricCard title="Critical" value={critical} hint="Needs immediate review" icon={AlertCircle} />
        <MetricCard title="Warning" value={warning} hint="Worth a second look" icon={AlertTriangle} />
        <MetricCard title="Info" value={info} hint="Routine activity" icon={Info} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Showing {rows.length} of {logs.length} events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actor, action or record..."
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="Employee">Employee</SelectItem>
                <SelectItem value="Access">Access</SelectItem>
                <SelectItem value="Data">Data</SelectItem>
                <SelectItem value="System">System</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Log ID</TableHead>
                  <TableHead className="w-[150px]">Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading activity...
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Couldn't load activity logs. Try refreshing the page.
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No activity matches your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {log.timestamp}
                      </TableCell>
                      <TableCell className="font-medium">{log.actor}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="text-muted-foreground">{log.target}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={SEVERITY_VARIANT[log.severity]} className="capitalize">
                          {log.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
