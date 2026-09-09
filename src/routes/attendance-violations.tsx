import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Pencil,
  Send,
  ShieldAlert,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { FilterSelect } from "@/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ViolationWizard } from "@/components/attendance/violation-wizard";
import { ImportViolationsDialog } from "@/components/attendance/import-violations-dialog";
import { BulkDeleteDialog } from "@/components/attendance/bulk-delete-dialog";
import { BulkSendDialog } from "@/components/attendance/bulk-send-dialog";
import { canEditViolation, EditViolationDialog } from "@/components/attendance/edit-violation-dialog";
import { SendConfirmDialog, type ConfirmableAction } from "@/components/attendance/send-confirm-dialog";
import {
  EMAIL_STATUSES,
  OFFICES,
  VIOLATION_TYPES,
  exportViolationsUrl,
  type EmailStatus,
  type Office,
  type ViolationRecord,
  type ViolationType,
} from "@/data/violation-api";
import {
  useAnalyticsOverviewQuery,
  useCreateViolation,
  useDeleteViolation,
  useViolationTransition,
  useViolationsQuery,
  type TransitionAction,
} from "@/data/violation-store";
import { useCurrentAccount } from "@/lib/session";
import { canApproveAttendance, canManageAttendance } from "@/lib/permissions";

export const Route = createFileRoute("/attendance-violations")({
  head: () => ({
    meta: [
      { title: "Attendance Violations — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content:
          "Track attendance violation records through Draft, Approval and Sent, with automated employee notification emails.",
      },
      {
        property: "og:title",
        content: "Attendance Violations — Torero Global Outsourcing HR Operations",
      },
      {
        property: "og:description",
        content: "Attendance violation tracking and email automation for Torero Global Outsourcing HR Operations.",
      },
    ],
  }),
  component: AttendanceViolationsPage,
});

const PAGE_SIZE = 20;

function StatusCell({ status, approvedByName }: { status: EmailStatus; approvedByName: string | null }) {
  const showApprover =
    approvedByName &&
    (status === "Approved" || status === "Resend Approved" || status === "Sent" || status === "Failed");
  return (
    <div className="flex flex-col gap-0.5">
      {status === "Sent" ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" /> Sent
        </span>
      ) : (
        <Badge variant="secondary">{status}</Badge>
      )}
      {showApprover && <span className="text-[11px] text-muted-foreground">Approved by {approvedByName}</span>}
    </div>
  );
}

function AttendanceViolationsPage() {
  const { data: account } = useCurrentAccount();
  const canWrite = canManageAttendance(account?.role);
  const canApprove = canApproveAttendance(account?.role);
  const isAdmin = account?.role === "admin";

  const [filters, setFilters] = useState({
    office: "",
    violationType: "",
    emailStatus: "",
    employeeEmail: "",
    dateFrom: "",
    dateTo: "",
  });
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; action: ConfirmableAction } | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);

  const updateFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const { data, isLoading } = useViolationsQuery(filters, page, PAGE_SIZE);
  const records = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: overview } = useAnalyticsOverviewQuery();

  useEffect(() => {
    setCheckedIds(new Set());
    // Clears the checkbox selection whenever the filters or page change,
    // since a checked id only makes sense against the rows it was checked
    // against — those rows aren't even fetched anymore once either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const checkedRecords = records.filter((r) => checkedIds.has(r.id));
  const editTarget = records.find((r) => r.id === editTargetId) ?? null;
  const allOnPageChecked = records.length > 0 && records.every((r) => checkedIds.has(r.id));
  const toggleAllOnPage = () => {
    setCheckedIds((prev) => {
      if (allOnPageChecked) return new Set();
      const next = new Set(prev);
      records.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const transition = useViolationTransition();
  const deleteMutation = useDeleteViolation();

  function runTransition(id: number, action: TransitionAction) {
    transition.mutate({ id, action }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed") });
  }

  const exportUrl = exportViolationsUrl(filters, "xlsx");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Violations"
        description="Track violation records through preparation, approval and automated employee notification."
      />

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard title="Total Records" value={overview.totalRecords} hint="All offices" icon={ClipboardList} />
          <MetricCard
            title="Pending Preparation"
            value={overview.pendingPreparation}
            hint="Ready to Prepare"
            icon={Timer}
          />
          <MetricCard
            title="Pending Approval"
            value={overview.pendingApproval}
            hint="Email Prepared"
            icon={ShieldAlert}
          />
          <MetricCard title="Failed" value={overview.failedCount} hint="Send failures" icon={XCircle} />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <FilterSelect
            value={filters.office || "all"}
            onChange={(v) => updateFilter({ office: v === "all" ? "" : v })}
            placeholder="Office"
            allLabel="All offices"
            options={[...OFFICES]}
          />
          <FilterSelect
            value={filters.violationType || "all"}
            onChange={(v) => updateFilter({ violationType: v === "all" ? "" : v })}
            placeholder="Type"
            allLabel="All violation types"
            options={[...VIOLATION_TYPES]}
          />
          <FilterSelect
            value={filters.emailStatus || "all"}
            onChange={(v) => updateFilter({ emailStatus: v === "all" ? "" : v })}
            placeholder="Status"
            allLabel="All statuses"
            options={[...EMAIL_STATUSES]}
          />
          <Input
            placeholder="Filter by employee email"
            value={filters.employeeEmail}
            onChange={(e) => updateFilter({ employeeEmail: e.target.value })}
            className="w-56"
          />
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter({ dateFrom: e.target.value })}
              className="w-36"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter({ dateTo: e.target.value })}
              className="w-36"
            />
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(exportUrl, "_blank")}>
              Export
            </Button>
            <ImportViolationsDialog onImported={() => {}} />
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>New record</Button>
              </DialogTrigger>
              <DialogContent>
                <CreateViolationForm onCreated={() => setCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {checkedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">
            {checkedIds.size} record{checkedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            {canApprove && (
              <Button size="sm" onClick={() => setBulkSendOpen(true)}>
                <Send className="size-4" /> Bulk send
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="size-4" /> Bulk delete
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setCheckedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageChecked}
                    onChange={toggleAllOnPage}
                    aria-label="Select all records on this page"
                    className="size-3.5 accent-primary"
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.id} className={checkedIds.has(r.id) ? "bg-primary/5" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.employeeName}`}
                      className="size-3.5 accent-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <button className="text-left hover:underline" onClick={() => setSelectedId(r.id)}>
                      {r.employeeName}
                    </button>
                    <div className="text-xs text-muted-foreground">{r.employeeEmail}</div>
                  </TableCell>
                  <TableCell>{r.office}</TableCell>
                  <TableCell>{r.violationTypeLabel}</TableCell>
                  <TableCell>{r.violationDate}</TableCell>
                  <TableCell>
                    <StatusCell status={r.emailStatus} approvedByName={r.approvedByName} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>
                        Open
                      </Button>
                      {canEditViolation(r.emailStatus) && canWrite && (
                        <Button size="sm" variant="outline" onClick={() => setEditTargetId(r.id)}>
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                      )}
                      {(r.emailStatus === "Hold" || r.emailStatus === "Needs Correction") && canWrite && (
                        <Button size="sm" variant="outline" onClick={() => runTransition(r.id, "mark-ready")}>
                          Mark Ready
                        </Button>
                      )}
                      {r.emailStatus === "Ready to Prepare" && canWrite && (
                        <Button size="sm" variant="outline" onClick={() => runTransition(r.id, "prepare")}>
                          Prepare
                        </Button>
                      )}
                      {r.emailStatus === "Email Prepared" && canApprove && (
                        <>
                          <Button size="sm" onClick={() => setConfirmTarget({ id: r.id, action: "approve" })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => runTransition(r.id, "hold")}>
                            Hold
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => runTransition(r.id, "needs-correction")}>
                            Needs Correction
                          </Button>
                        </>
                      )}
                      {(r.emailStatus === "Approved" || r.emailStatus === "Resend Approved") && canApprove && (
                        <Button size="sm" onClick={() => setConfirmTarget({ id: r.id, action: "send-now" })}>
                          Send now
                        </Button>
                      )}
                      {r.emailStatus === "Sent" && canApprove && (
                        <Button size="sm" variant="outline" onClick={() => runTransition(r.id, "resend")}>
                          Resend
                        </Button>
                      )}
                      {r.emailStatus === "Failed" && canApprove && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmTarget({ id: r.id, action: "reapprove" })}>
                          Re-approve &amp; retry
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            if (window.confirm(`Delete the record for ${r.employeeName}? This is kept for the audit trail, not fully erased.`)) {
                              deleteMutation.mutate(r.id, {
                                onSuccess: () => toast.success(`Deleted the record for ${r.employeeName}`),
                                onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
                              });
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No records match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? "0 records" : `${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <ViolationWizard recordId={selectedId} open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)} />

      <SendConfirmDialog
        recordId={confirmTarget?.id ?? null}
        action={confirmTarget?.action ?? "approve"}
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        busy={transition.isPending}
        onConfirm={() => {
          if (!confirmTarget) return;
          const action = confirmTarget.action === "send-now" ? "send-now" : "approve";
          transition.mutate({ id: confirmTarget.id, action }, { onSuccess: () => setConfirmTarget(null) });
        }}
      />

      <BulkDeleteDialog
        records={checkedRecords}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onDeleted={() => setCheckedIds(new Set())}
      />

      <BulkSendDialog
        records={checkedRecords}
        open={bulkSendOpen}
        onOpenChange={setBulkSendOpen}
        onDone={() => setCheckedIds(new Set())}
      />

      {editTarget && (
        <EditViolationDialog
          record={editTarget}
          open={editTargetId !== null}
          onOpenChange={(open) => setEditTargetId(open ? editTargetId : null)}
          onSaved={() => setEditTargetId(null)}
        />
      )}
    </div>
  );
}

function CreateViolationForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    office: "PH" as Office,
    employeeName: "",
    employeeEmail: "",
    violationType: "Late Arrival" as ViolationType,
    violationTypeOther: "",
    violationDate: "",
    reason: "",
  });
  const isOther = form.violationType === "Other";
  const otherMissing = isOther && !form.violationTypeOther.trim();
  const createMutation = useCreateViolation();

  return (
    <div className="flex flex-col gap-3">
      <DialogTitle>New violation record</DialogTitle>
      <div className="grid grid-cols-2 gap-3">
        <Select value={form.office} onValueChange={(v) => setForm((f) => ({ ...f, office: v as Office }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OFFICES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form.violationType} onValueChange={(v) => setForm((f) => ({ ...f, violationType: v as ViolationType }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIOLATION_TYPES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Employee name"
          value={form.employeeName}
          onChange={(e) => setForm((f) => ({ ...f, employeeName: e.target.value }))}
        />
        <Input
          placeholder="Employee email"
          value={form.employeeEmail}
          onChange={(e) => setForm((f) => ({ ...f, employeeEmail: e.target.value }))}
        />
        <Input
          type="date"
          value={form.violationDate}
          onChange={(e) => setForm((f) => ({ ...f, violationDate: e.target.value }))}
        />
        {isOther && (
          <Input
            placeholder="Please specify the violation type"
            value={form.violationTypeOther}
            onChange={(e) => setForm((f) => ({ ...f, violationTypeOther: e.target.value }))}
          />
        )}
        <Input
          placeholder="Reason (or leave blank for 'No reason given')"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          className="col-span-2"
        />
      </div>
      <DialogFooter>
        <Button
          disabled={createMutation.isPending || otherMissing || !form.employeeName || !form.employeeEmail || !form.violationDate}
          onClick={() =>
            createMutation.mutate(form, {
              onSuccess: onCreated,
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create record"),
            })
          }
        >
          {createMutation.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  );
}
