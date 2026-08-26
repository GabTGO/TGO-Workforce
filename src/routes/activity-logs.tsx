import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
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

type LogCategory = "Employee" | "Access" | "Data" | "System";
type LogSeverity = "info" | "warning" | "critical";

type ActivityLog = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  category: LogCategory;
  severity: LogSeverity;
};

const ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: "LOG-1041",
    timestamp: "2026-08-26 15:52",
    actor: "Gabriel Torres",
    action: "Created employee record",
    target: "TGO-0241 · Marisol Reyes",
    category: "Employee",
    severity: "info",
  },
  {
    id: "LOG-1040",
    timestamp: "2026-08-26 14:07",
    actor: "Gabriel Torres",
    action: "Exported directory to CSV",
    target: "Employee Directory (218 rows)",
    category: "Data",
    severity: "warning",
  },
  {
    id: "LOG-1039",
    timestamp: "2026-08-26 11:31",
    actor: "Ana Villegas",
    action: "Updated position",
    target: "TGO-0187 · Senior AI Analyst",
    category: "Employee",
    severity: "info",
  },
  {
    id: "LOG-1038",
    timestamp: "2026-08-25 18:44",
    actor: "System",
    action: "Nightly sync completed",
    target: "PH Eastwood · CO Medellin",
    category: "System",
    severity: "info",
  },
  {
    id: "LOG-1037",
    timestamp: "2026-08-25 16:10",
    actor: "Ramon Cruz",
    action: "Failed sign-in attempt",
    target: "ramon.cruz@tgo.internal",
    category: "Access",
    severity: "critical",
  },
  {
    id: "LOG-1036",
    timestamp: "2026-08-25 09:22",
    actor: "Ana Villegas",
    action: "Bulk upload processed",
    target: "new-hires-august.xlsx (14 rows)",
    category: "Data",
    severity: "info",
  },
  {
    id: "LOG-1035",
    timestamp: "2026-08-24 17:03",
    actor: "Gabriel Torres",
    action: "Marked employee as resigned",
    target: "TGO-0122 · Luis Fernandez",
    category: "Employee",
    severity: "warning",
  },
  {
    id: "LOG-1034",
    timestamp: "2026-08-24 08:15",
    actor: "System",
    action: "Retention policy applied",
    target: "Archived 6 exited records",
    category: "System",
    severity: "info",
  },
  {
    id: "LOG-1033",
    timestamp: "2026-08-23 13:48",
    actor: "Ramon Cruz",
    action: "Granted portal access",
    target: "people.ops@tgo.internal",
    category: "Access",
    severity: "warning",
  },
];

const SEVERITY_VARIANT: Record<LogSeverity, "secondary" | "outline" | "destructive"> = {
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACTIVITY_LOGS.filter((log) => {
      const matchesQuery =
        !q ||
        [log.id, log.actor, log.action, log.target].some((v) => v.toLowerCase().includes(q));
      const matchesCategory = category === "all" || log.category === category;
      const matchesSeverity = severity === "all" || log.severity === severity;
      return matchesQuery && matchesCategory && matchesSeverity;
    });
  }, [query, category, severity]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Audit trail of record changes, access events, data exports and system jobs."
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Showing {rows.length} of {ACTIVITY_LOGS.length} events from the last 7 days.
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
                {rows.length === 0 ? (
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
