// Employee Benefits — HMO Management. Ported (functionality + tabs, not
// visual design) from the standalone HR portal reference prototype's HMO
// module, restyled entirely with this app's own components/theme. Still a
// frontend-only prototype: there's no backend for this module yet (see
// backend/app/models/permission.py's Permission.BENEFITS_VIEW/MANAGE
// comment), so every member/dependent/request/billing row here is
// hand-authored fictional demo data (@/data/hmo-mock.ts) — deliberately NOT
// derived from the real Employee Directory, so nothing here is mistakable
// for an actual person's actual enrollment. Everything lives in this page's
// local state; nothing persists across a reload.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  HeartPulse,
  IdCard,
  Plus,
  Receipt,
  ShieldAlert,
  Users,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEPENDENT_RELATIONSHIPS,
  HMO_COVERAGE_TYPES,
  HMO_MEMBER_STATUSES,
  HMO_PLANS,
  HMO_PROVIDER,
  HMO_REQUEST_TYPES,
  generateHmoBilling,
  generateHmoDependents,
  generateHmoMembers,
  generateHmoRequests,
  type DependentRelationship,
  type HmoBillingRecord,
  type HmoDependent,
  type HmoMember,
  type HmoMemberStatus,
  type HmoRequest,
  type HmoRequestStatus,
  type HmoRequestType,
} from "@/data/hmo-mock";
import { canManageBenefits, canViewBenefits } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { useCurrentAccount } from "@/lib/session";

export const Route = createFileRoute("/hmo-management")({
  head: () => ({
    meta: [
      { title: "HMO Management — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Employee Benefits: HMO enrollment, dependents, cards, requests and billing.",
      },
    ],
  }),
  component: HmoManagementPage,
});

const ALL = "all";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Activated: "default",
  Approved: "default",
  Verified: "default",
  Paid: "default",
  Issued: "default",
  Released: "default",
  Pending: "outline",
  "For Processing": "outline",
  Submitted: "outline",
  "Ready for Submission": "outline",
  "Waiting for Requirements": "outline",
  Disputed: "outline",
  "Not Eligible": "secondary",
  "Not Issued": "secondary",
  Suspended: "secondary",
  Terminated: "destructive",
  Rejected: "destructive",
};

const PENDING_ENROLLMENT_STATUSES: HmoMemberStatus[] = [
  "Waiting for Requirements",
  "Ready for Submission",
  "Submitted",
  "For Processing",
];

const enrollmentTrendConfig = {
  members: { label: "Activated Members", color: "var(--chart-1)" },
} satisfies ChartConfig;

const coverageChartConfig = {
  count: { label: "Members" },
  "Employee Only": { label: "Employee Only", color: "var(--chart-1)" },
  "Employee + Spouse": { label: "Employee + Spouse", color: "var(--chart-2)" },
  "Employee + Dependents": { label: "Employee + Dependents", color: "var(--chart-3)" },
  Family: { label: "Family", color: "var(--chart-4)" },
} satisfies ChartConfig;

const departmentChartConfig = {
  pending: { label: "Pending Enrollment", color: "var(--chart-2)" },
} satisfies ChartConfig;

function enrollmentTrend(members: HmoMember[]) {
  const now = new Date();
  const months = 7;
  return Array.from({ length: months }, (_, i) => {
    const monthsAgo = months - 1 - i;
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const label = monthDate.toLocaleString("en-US", { month: "short" });
    const members_ = members.filter(
      (m) => m.enrollmentDate && new Date(m.enrollmentDate) <= monthEnd,
    ).length;
    return { month: label, members: members_ };
  });
}

function daysUntil(dateIso: string): number {
  return Math.round((new Date(dateIso).getTime() - Date.now()) / 86_400_000);
}

function formatCurrency(amount: number): string {
  return `₱${Math.abs(amount).toLocaleString()}`;
}

function HmoManagementPage() {
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewBenefits(account?.permissions);
  const canManage = canManageBenefits(account?.permissions);

  const [members] = useState<HmoMember[]>(() => generateHmoMembers());
  const [dependents, setDependents] = useState<HmoDependent[]>(() =>
    generateHmoDependents(members),
  );
  const [requests, setRequests] = useState<HmoRequest[]>(() => generateHmoRequests(members));
  const [billing] = useState<HmoBillingRecord[]>(() => generateHmoBilling());

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addDependentOpen, setAddDependentOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchesQuery = !q || m.name.toLowerCase().includes(q);
      const matchesPlan = planFilter === ALL || m.plan === planFilter;
      const matchesStatus = statusFilter === ALL || m.status === statusFilter;
      return matchesQuery && matchesPlan && matchesStatus;
    });
  }, [members, search, planFilter, statusFilter]);

  const enrollmentQueue = useMemo(
    () => members.filter((m) => PENDING_ENROLLMENT_STATUSES.includes(m.status)),
    [members],
  );

  // --- KPIs -----------------------------------------------------------
  const activeMembers = members.filter((m) => m.status === "Activated").length;
  const pendingEnrollmentCount = enrollmentQueue.length;
  const becomingEligible = members.filter(
    (m) =>
      m.status === "Not Eligible" &&
      daysUntil(m.eligibilityDate) <= 30 &&
      daysUntil(m.eligibilityDate) >= 0,
  ).length;
  const dependentsPending = dependents.filter((d) => d.status === "Pending").length;
  const virtualCardsPending = members.filter((m) => m.virtualCardStatus === "Pending").length;
  const physicalCardsPending = members.filter((m) => m.physicalCardStatus === "Pending").length;
  const pendingRequestsCount = requests.filter((r) => r.status === "Pending").length;
  const latestBilling = billing[billing.length - 1];
  const billingVariance = latestBilling
    ? latestBilling.billedAmount - latestBilling.expectedAmount
    : 0;

  // --- Overview chart data ---------------------------------------------
  const trendData = enrollmentTrend(members);
  const activatedMembers = members.filter((m) => m.status === "Activated");
  const coverageData = HMO_COVERAGE_TYPES.map((type) => ({
    coverageType: type,
    count: activatedMembers.filter((m) => m.coverageType === type).length,
  })).filter((d) => d.count > 0);
  const statusBreakdown = HMO_MEMBER_STATUSES.map((status) => ({
    status,
    count: members.filter((m) => m.status === status).length,
  }));
  const maxStatusCount = Math.max(1, ...statusBreakdown.map((s) => s.count));
  const departmentPending = useMemo(() => {
    const byDept = new Map<string, number>();
    for (const m of enrollmentQueue) {
      byDept.set(m.department, (byDept.get(m.department) ?? 0) + 1);
    }
    return Array.from(byDept.entries()).map(([department, pending]) => ({ department, pending }));
  }, [enrollmentQueue]);

  const selectedMember = selectedMemberId ? (memberById.get(selectedMemberId) ?? null) : null;
  const selectedDependents = selectedMemberId
    ? dependents.filter((d) => d.memberId === selectedMemberId)
    : [];

  function addDependent(
    memberId: string,
    dependent: { name: string; relationship: DependentRelationship; birthday: string },
  ) {
    setDependents((prev) => [
      ...prev,
      {
        id: `${memberId}-dep-${prev.length}-${Date.now()}`,
        memberId,
        status: "Pending",
        ...dependent,
      },
    ]);
  }

  function addRequest(input: { memberId: string; type: HmoRequestType; notes: string }) {
    setRequests((prev) => [
      {
        id: `req-${input.memberId}-${Date.now()}`,
        memberId: input.memberId,
        type: input.type,
        status: "Pending",
        submittedDate: new Date().toISOString().slice(0, 10),
        notes: input.notes,
      },
      ...prev,
    ]);
  }

  function setRequestStatus(requestId: string, status: HmoRequestStatus) {
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
    toast.success(`Request ${status.toLowerCase()}`);
  }

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="HMO Management" description="Employee Benefits." />
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="HMO Management" description="Employee Benefits." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No access</p>
              <p className="text-sm text-muted-foreground">
                Your account ({account ? ROLE_LABELS[account.role] : "signed out"}) doesn't have
                access to Employee Benefits. Ask a Super Admin to grant it from the permission
                matrix on User Management if you need it.
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
        title="HMO Management"
        description={`Enrollment, dependents, cards, requests and billing for ${HMO_PROVIDER} — mock data for now.`}
        badge={
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            In Progress
          </Badge>
        }
        action={
          canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddDependentOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Add Dependent
              </Button>
              <Button size="sm" onClick={() => setNewRequestOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New HMO Request
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active HMO Members"
          value={activeMembers}
          hint={HMO_PROVIDER}
          icon={HeartPulse}
        />
        <MetricCard
          title="Pending Enrollment"
          value={pendingEnrollmentCount}
          hint="Awaiting requirements or processing"
          icon={UserPlus}
        />
        <MetricCard
          title="Becoming Eligible"
          value={becomingEligible}
          hint="Within the next 30 days"
          icon={Calendar}
        />
        <MetricCard
          title="Dependents Pending"
          value={dependentsPending}
          hint="For verification"
          icon={Users}
        />
        <MetricCard
          title="Virtual Cards Pending"
          value={virtualCardsPending}
          hint="Not yet released"
          icon={CreditCard}
        />
        <MetricCard
          title="Physical Cards Pending"
          value={physicalCardsPending}
          hint="For processing or release"
          icon={IdCard}
        />
        <MetricCard
          title="HMO Requests Pending"
          value={pendingRequestsCount}
          hint="Open items"
          icon={Wallet}
        />
        <MetricCard
          title="Billing Variance"
          value={`${billingVariance < 0 ? "-" : "+"}${formatCurrency(billingVariance)}`}
          hint="Latest month vs. expected"
          icon={Receipt}
        />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="queue">Enrollment Queue</TabsTrigger>
            <TabsTrigger value="dependents">Dependents</TabsTrigger>
            <TabsTrigger value="members">HMO Members</TabsTrigger>
            <TabsTrigger value="cards">Card Tracking</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {pendingRequestsCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
        </div>

        {/* --- Overview --- */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>HMO Enrollment Trend</CardTitle>
                <CardDescription>Activated members, last 7 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={enrollmentTrendConfig} className="h-[260px] w-full">
                  <AreaChart data={trendData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="members"
                      stroke="var(--color-members)"
                      fill="var(--color-members)"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coverage Distribution</CardTitle>
                <CardDescription>Activated members by coverage type</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={coverageChartConfig} className="mx-auto h-[260px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="coverageType" />} />
                    <Pie
                      data={coverageData}
                      dataKey="count"
                      nameKey="coverageType"
                      innerRadius={55}
                      outerRadius={90}
                    >
                      {coverageData.map((entry) => (
                        <Cell
                          key={entry.coverageType}
                          fill={`var(--color-${entry.coverageType})`}
                        />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="coverageType" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Member Status</CardTitle>
                <CardDescription>All members by HMO status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusBreakdown.map((s) => (
                  <div key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{s.status}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(s.count / maxStatusCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Enrollment by Department</CardTitle>
                <CardDescription>Cases awaiting completion</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={departmentChartConfig} className="h-[280px] w-full">
                  <BarChart data={departmentPending}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="department"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="pending" fill="var(--color-pending)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- Enrollment Queue --- */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Eligibility Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollmentQueue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Nothing in the enrollment queue.
                        </TableCell>
                      </TableRow>
                    ) : (
                      enrollmentQueue.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium whitespace-nowrap">{m.name}</TableCell>
                          <TableCell>{m.department}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {m.eligibilityDate}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Dependents --- */}
        <TabsContent value="dependents" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dependent</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Birthday</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dependents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No dependents on file.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dependents.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium whitespace-nowrap">{d.name}</TableCell>
                          <TableCell>{d.relationship}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {memberById.get(d.memberId)?.name ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {d.birthday}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- HMO Members --- */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member name..."
              className="max-w-xs"
            />
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All plans</SelectItem>
                {HMO_PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {HMO_MEMBER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No members match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMembers.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium whitespace-nowrap">{m.name}</TableCell>
                          <TableCell className="whitespace-nowrap">{m.department}</TableCell>
                          <TableCell>{m.plan}</TableCell>
                          <TableCell className="font-mono text-xs">{m.policyNumber}</TableCell>
                          <TableCell>{formatCurrency(m.coverageAmount)}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedMemberId(m.id)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Card Tracking --- */}
        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Virtual Card</TableHead>
                      <TableHead>Physical Card</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium whitespace-nowrap">{m.name}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[m.virtualCardStatus]}>
                            {m.virtualCardStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[m.physicalCardStatus]}>
                            {m.physicalCardStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Requests --- */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="w-40 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 6 : 5}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No requests yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      requests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {memberById.get(r.memberId)?.name ?? "—"}
                          </TableCell>
                          <TableCell>{r.type}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {r.submittedDate}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {r.notes || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              {r.status === "Pending" ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-emerald-600 hover:text-emerald-600"
                                    onClick={() => setRequestStatus(r.id, "Approved")}
                                    aria-label="Approve"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setRequestStatus(r.id, "Rejected")}
                                    aria-label="Reject"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Billing --- */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {HMO_PROVIDER} — Monthly Billing
              </CardTitle>
              <CardDescription>Expected vs. billed premium totals</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Billed</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billing.map((b) => {
                      const variance = b.billedAmount - b.expectedAmount;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.month}</TableCell>
                          <TableCell>{formatCurrency(b.expectedAmount)}</TableCell>
                          <TableCell>{formatCurrency(b.billedAmount)}</TableCell>
                          <TableCell
                            className={variance < 0 ? "text-destructive" : "text-muted-foreground"}
                          >
                            {variance === 0
                              ? "—"
                              : `${variance < 0 ? "-" : "+"}${formatCurrency(variance)}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedMemberId} onOpenChange={(next) => !next && setSelectedMemberId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedMember && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMember.name}</SheetTitle>
                <SheetDescription>
                  {selectedMember.position} · {selectedMember.department}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{selectedMember.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coverage Type</p>
                  <p className="font-medium">{selectedMember.coverageType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Policy Number</p>
                  <p className="font-mono text-xs font-medium">{selectedMember.policyNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coverage Amount</p>
                  <p className="font-medium">{formatCurrency(selectedMember.coverageAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Premium</p>
                  <p className="font-medium">{formatCurrency(selectedMember.monthlyPremium)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={STATUS_VARIANT[selectedMember.status]}>
                    {selectedMember.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Virtual Card</p>
                  <Badge variant={STATUS_VARIANT[selectedMember.virtualCardStatus]}>
                    {selectedMember.virtualCardStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Physical Card</p>
                  <Badge variant={STATUS_VARIANT[selectedMember.physicalCardStatus]}>
                    {selectedMember.physicalCardStatus}
                  </Badge>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Dependents</h3>
                {selectedDependents.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No dependents on file.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedDependents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-md border p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.relationship} · {d.birthday}
                          </p>
                        </div>
                        <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddDependentDialog
        open={addDependentOpen}
        onOpenChange={setAddDependentOpen}
        members={members}
        preselectedMemberId={selectedMemberId}
        onSubmit={(input) => {
          addDependent(input.memberId, input);
          setAddDependentOpen(false);
          toast.success(`Added ${input.name} as a dependent`);
        }}
      />

      <NewRequestDialog
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        members={members}
        onSubmit={(input) => {
          addRequest(input);
          setNewRequestOpen(false);
          toast.success("Request submitted");
        }}
      />
    </div>
  );
}

function AddDependentDialog({
  open,
  onOpenChange,
  members,
  preselectedMemberId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: HmoMember[];
  preselectedMemberId: string | null;
  onSubmit: (input: {
    memberId: string;
    name: string;
    relationship: DependentRelationship;
    birthday: string;
  }) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<DependentRelationship>("Spouse");
  const [birthday, setBirthday] = useState("");

  function reset() {
    setMemberId("");
    setName("");
    setRelationship("Spouse");
    setBirthday("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setMemberId((prev) => prev || preselectedMemberId || "");
        else reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Dependent</DialogTitle>
          <DialogDescription>Add a covered dependent to a member's enrollment.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dep-name">Full name</Label>
            <Input id="dep-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Relationship</Label>
            <Select
              value={relationship}
              onValueChange={(v) => setRelationship(v as DependentRelationship)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPENDENT_RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dep-birthday">Birthday</Label>
            <Input
              id="dep-birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!memberId || !name.trim() || !birthday}
            onClick={() => onSubmit({ memberId, name: name.trim(), relationship, birthday })}
          >
            Add Dependent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewRequestDialog({
  open,
  onOpenChange,
  members,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: HmoMember[];
  onSubmit: (input: { memberId: string; type: HmoRequestType; notes: string }) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<HmoRequestType>("New Enrollment");
  const [notes, setNotes] = useState("");

  function reset() {
    setMemberId("");
    setType("New Enrollment");
    setNotes("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New HMO Request</DialogTitle>
          <DialogDescription>Submit a benefits request for a member.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Request type</Label>
            <Select value={type} onValueChange={(v) => setType(v as HmoRequestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HMO_REQUEST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="req-notes">Notes (optional)</Label>
            <Textarea id="req-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!memberId}
            onClick={() => onSubmit({ memberId, type, notes: notes.trim() })}
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
