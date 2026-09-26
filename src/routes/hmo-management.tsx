// Employee Benefits — HMO Management. First real UI pass, ported from the
// standalone HR portal reference prototype's HMO module (members,
// dependents, enrollment requests) and restyled to this app's own theme —
// still frontend-only prototype data, though: there's no backend for this
// module yet (see backend/app/models/permission.py's Permission.
// BENEFITS_VIEW/MANAGE comment), so every member/dependent/request here is
// generated client-side from the real Employee Directory
// (@/data/hmo-mock.ts) and lives only in this page's local state — nothing
// persists across a reload, and no dependent names/relationships are
// invented for anyone (see that file's docstring for why).
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Check,
  HeartPulse,
  Plus,
  ShieldAlert,
  Users,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { EmployeeNameLink } from "@/components/employee-name-link";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useEmployees } from "@/data/employee-store";
import { formatDate } from "@/data/employees";
import {
  DEPENDENT_RELATIONSHIPS,
  HMO_PLANS,
  HMO_PROVIDERS,
  HMO_REQUEST_TYPES,
  generateHmoMembers,
  generateHmoRequests,
  type DependentRelationship,
  type HmoMember,
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
        content: "Employee Benefits: HMO enrollment, dependents and requests.",
      },
    ],
  }),
  component: HmoManagementPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Pending: "outline",
  Inactive: "secondary",
  Approved: "default",
  Rejected: "destructive",
};

const ALL = "all";

function HmoManagementPage() {
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewBenefits(account?.permissions);
  const canManage = canManageBenefits(account?.permissions);
  const employees = useEmployees();

  const [members, setMembers] = useState<HmoMember[]>([]);
  const [requests, setRequests] = useState<HmoRequest[]>([]);
  const [seeded, setSeeded] = useState(false);

  // Seed once, the first time real employee data actually arrives — not a
  // useMemo keyed on `employees`, since that array gets a fresh reference
  // every ~15s poll even when nothing changed, which would otherwise wipe
  // any dependent/request a Super Admin added during the session.
  useEffect(() => {
    if (seeded || employees.length === 0) return;
    const generatedMembers = generateHmoMembers(employees);
    setMembers(generatedMembers);
    setRequests(generateHmoRequests(generatedMembers));
    setSeeded(true);
  }, [seeded, employees]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>(ALL);
  const [providerFilter, setProviderFilter] = useState<string>(ALL);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addDependentOpen, setAddDependentOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const employee = employeeById.get(m.employeeId);
      const matchesQuery = !q || !employee || employee.name.toLowerCase().includes(q);
      const matchesPlan = planFilter === ALL || m.plan === planFilter;
      const matchesProvider = providerFilter === ALL || m.provider === providerFilter;
      return matchesQuery && matchesPlan && matchesProvider;
    });
  }, [members, employeeById, search, planFilter, providerFilter]);

  const totalDependents = members.reduce((sum, m) => sum + m.dependents.length, 0);
  const pendingRequests = requests.filter((r) => r.status === "Pending").length;
  const providerCount = new Set(members.map((m) => m.provider)).size;

  const selectedMember = members.find((m) => m.employeeId === selectedMemberId) ?? null;
  const selectedEmployee = selectedMember ? employeeById.get(selectedMember.employeeId) : undefined;

  function addDependent(
    employeeId: string,
    dependent: { name: string; relationship: DependentRelationship; birthday: string },
  ) {
    setMembers((prev) =>
      prev.map((m) =>
        m.employeeId === employeeId
          ? {
              ...m,
              dependents: [
                ...m.dependents,
                {
                  id: `${employeeId}-dep-${m.dependents.length}-${Date.now()}`,
                  status: "Active",
                  ...dependent,
                },
              ],
            }
          : m,
      ),
    );
  }

  function addRequest(input: { employeeId: string; type: HmoRequestType; notes: string }) {
    setRequests((prev) => [
      {
        id: `req-${input.employeeId}-${Date.now()}`,
        employeeId: input.employeeId,
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
        description="Enrollment, dependents and requests — demo data seeded from the Employee Directory."
        badge={
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            In Progress
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Members"
          value={members.length}
          hint="Active enrollments"
          icon={HeartPulse}
        />
        <MetricCard
          title="Dependents"
          value={totalDependents}
          hint="Covered dependents"
          icon={Users}
        />
        <MetricCard
          title="Pending Requests"
          value={pendingRequests}
          hint="Awaiting action"
          icon={Wallet}
        />
        <MetricCard
          title="Providers"
          value={providerCount}
          hint="Distinct HMO providers"
          icon={Building2}
        />
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {pendingRequests > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {pendingRequests}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

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
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All providers</SelectItem>
                {HMO_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
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
                      <TableHead>Plan</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Dependents</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          {members.length === 0
                            ? "Loading members…"
                            : "No members match your search."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMembers.map((m) => {
                        const employee = employeeById.get(m.employeeId);
                        return (
                          <TableRow key={m.employeeId}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {employee ? <EmployeeNameLink employee={employee} /> : m.employeeId}
                            </TableCell>
                            <TableCell>{m.plan}</TableCell>
                            <TableCell>{m.provider}</TableCell>
                            <TableCell className="font-mono text-xs">{m.policyNumber}</TableCell>
                            <TableCell>₱{m.coverageAmount.toLocaleString()}</TableCell>
                            <TableCell>{m.dependents.length}</TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedMemberId(m.employeeId)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Button size="sm" onClick={() => setNewRequestOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Request
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
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
                      requests.map((r) => {
                        const employee = employeeById.get(r.employeeId);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {employee ? <EmployeeNameLink employee={employee} /> : r.employeeId}
                            </TableCell>
                            <TableCell>{r.type}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {formatDate(r.submittedDate)}
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
                        );
                      })
                    )}
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
                <SheetTitle>{selectedEmployee?.name ?? selectedMember.employeeId}</SheetTitle>
                <SheetDescription>
                  {selectedEmployee?.position || "—"} · {selectedEmployee?.department}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{selectedMember.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="font-medium">{selectedMember.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Policy Number</p>
                  <p className="font-mono text-xs font-medium">{selectedMember.policyNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coverage</p>
                  <p className="font-medium">₱{selectedMember.coverageAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enrolled</p>
                  <p className="font-medium">{formatDate(selectedMember.enrollmentDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={STATUS_VARIANT[selectedMember.status]}>
                    {selectedMember.status}
                  </Badge>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Dependents</h3>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setAddDependentOpen(true)}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" /> Add Dependent
                    </Button>
                  )}
                </div>
                {selectedMember.dependents.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No dependents on file.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedMember.dependents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-md border p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.relationship} · {formatDate(d.birthday)}
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

      {selectedMember && (
        <AddDependentDialog
          open={addDependentOpen}
          onOpenChange={setAddDependentOpen}
          onSubmit={(dependent) => {
            addDependent(selectedMember.employeeId, dependent);
            setAddDependentOpen(false);
            toast.success(`Added ${dependent.name} as a dependent`);
          }}
        />
      )}

      <NewRequestDialog
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        members={members}
        employeeById={employeeById}
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
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dependent: {
    name: string;
    relationship: DependentRelationship;
    birthday: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<DependentRelationship>("Spouse");
  const [birthday, setBirthday] = useState("");

  function reset() {
    setName("");
    setRelationship("Spouse");
    setBirthday("");
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
          <DialogTitle>Add Dependent</DialogTitle>
          <DialogDescription>
            Add a covered dependent to this member's enrollment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
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
            disabled={!name.trim() || !birthday}
            onClick={() => onSubmit({ name: name.trim(), relationship, birthday })}
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
  employeeById,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: HmoMember[];
  employeeById: Map<string, { name: string }>;
  onSubmit: (input: { employeeId: string; type: HmoRequestType; notes: string }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<HmoRequestType>("New Enrollment");
  const [notes, setNotes] = useState("");

  function reset() {
    setEmployeeId("");
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
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.employeeId} value={m.employeeId}>
                    {employeeById.get(m.employeeId)?.name ?? m.employeeId}
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
            disabled={!employeeId}
            onClick={() => onSubmit({ employeeId, type, notes: notes.trim() })}
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
