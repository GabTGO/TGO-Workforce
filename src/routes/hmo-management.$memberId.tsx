// Full HMO member profile — SOP section 7's sample layout (header +
// Employee Information / Membership & Coverage / Payment & Billing /
// Enrollment & Card / Offboarding sections) plus an Activity History panel
// (section 8), reachable by clicking a member's name or "View" in
// hmo-management.index.tsx. A real page, not a dialog — same reasoning as
// directory.$employeeId.tsx: linkable/shareable/back-buttonable.
import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHmoMemberActivityLogs } from "@/data/activity-log-store";
import {
  HMO_ENROLLMENT_STATUSES,
  HMO_INACTIVE_REASONS,
  HMO_MANAGER_EVALUATIONS,
  HMO_MEMBER_STATUSES,
  HMO_PHYSICAL_CARD_STATUSES,
  HMO_REMOVAL_STATUSES,
  HMO_VIRTUAL_CARD_STATUSES,
} from "@/data/hmo-api";
import { useHmoMembersQuery, useUpdateHmoMember } from "@/data/hmo-store";
import { canManageBenefits, canViewBenefits } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { useCurrentAccount } from "@/lib/session";

export const Route = createFileRoute("/hmo-management/$memberId")({
  head: () => ({
    meta: [{ title: "HMO Member Profile — Torero Global Outsourcing HR Operations" }],
  }),
  component: HmoMemberProfilePage,
});

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(dateIso: string | null): string {
  if (!dateIso) return "—";
  return new Date(dateIso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const backLink = (
  <Link
    to="/hmo-management"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="h-4 w-4" /> Back to HMO Management
  </Link>
);

function HmoMemberProfilePage() {
  const { memberId } = Route.useParams();
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewBenefits(account?.permissions);
  const canManage = canManageBenefits(account?.permissions);

  const { data: membersData, isLoading: membersLoading } = useHmoMembersQuery(canView);
  const members = useMemo(() => membersData ?? [], [membersData]);
  const member = members.find((m) => m.id === memberId);
  const principal = member?.principalMemberId
    ? members.find((m) => m.id === member.principalMemberId)
    : undefined;

  const { data: activityLogs } = useHmoMemberActivityLogs(memberId);

  const updateMutation = useUpdateHmoMember();
  const [billingRemarks, setBillingRemarks] = useState(member?.billingRemarks ?? "");
  const [enrollmentRemarks, setEnrollmentRemarks] = useState(member?.enrollmentRemarks ?? "");
  const [removalRemarks, setRemovalRemarks] = useState(member?.removalRemarks ?? "");

  function patch(fields: Record<string, unknown>) {
    if (!member) return;
    updateMutation.mutate(
      { id: member.id, patch: fields },
      {
        onError: (error) => {
          console.error(error);
          toast.error(error instanceof Error ? error.message : "Couldn't save that change.");
        },
      },
    );
  }

  if (accountLoading || membersLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <PageHeader title="HMO Member Profile" description="Loading…" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        {backLink}
        <PageHeader title="HMO Member Profile" description="Employee Benefits." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No access</p>
              <p className="text-sm text-muted-foreground">
                Your account ({account ? ROLE_LABELS[account.role] : "signed out"}) doesn't have
                access to Employee Benefits.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!member) {
    throw notFound();
  }

  return (
    <div className="space-y-6">
      {backLink}
      <PageHeader
        title={member.displayName}
        description={
          member.memberType === "Principal"
            ? `${member.department ?? "—"} · Principal Member`
            : `${principal?.displayName ?? "—"}'s dependent (${member.relationshipToPrincipal ?? "—"})`
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials(member.displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{member.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {member.memberType === "Principal" ? member.employeeId : "Dependent"} ·{" "}
                {member.department ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>HMO Status: {member.memberStatus}</Badge>
            <Badge variant="secondary">Enrollment Status: {member.enrollmentStatus}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {member.memberType === "Principal" && (
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Employee ID</p>
                <p className="font-medium">{member.employeeId ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium">{member.department ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hire Date</p>
                <p className="font-medium">{formatDate(member.hireDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">HMO Eligibility Date</p>
                <p className="font-medium">{formatDate(member.eligibilityDate)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Manager Evaluation</p>
                {canManage ? (
                  <Select
                    value={member.managerEvaluation || ""}
                    onValueChange={(v) => patch({ managerEvaluation: v })}
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      {HMO_MANAGER_EVALUATIONS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{member.managerEvaluation ?? "—"}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {member.memberType === "Dependent" && (
          <Card>
            <CardHeader>
              <CardTitle>Dependent Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Principal Member</p>
                <p className="font-medium">{principal?.displayName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Relationship</p>
                <p className="font-medium">{member.relationshipToPrincipal ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Birthday</p>
                <p className="font-medium">{formatDate(member.birthday)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Membership & Coverage</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">HMO Card Number</p>
              <p className="font-medium">{member.hmoCardNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Member Status</p>
              {canManage ? (
                <Select
                  value={member.memberStatus}
                  onValueChange={(v) => patch({ memberStatus: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_MEMBER_STATUSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.memberStatus}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rank</p>
              <p className="font-medium">{member.rank ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Room & Board</p>
              <p className="font-medium">{member.roomAndBoard ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MBL</p>
              <p className="font-medium">{member.mbl ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dental / APE</p>
              <p className="font-medium">
                {member.dental ?? "—"} / {member.ape ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment & Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Monthly Premium</p>
              <p className="font-medium">{formatCurrency(member.monthlyPremium)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bi-Weekly Deduction</p>
              <p className="font-medium">{formatCurrency(member.biweeklyDeduction)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Billing Status</p>
              {canManage ? (
                <Select
                  value={member.billingStatus}
                  onValueChange={(v) => patch({ billingStatus: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Not Yet Billed",
                      "Included in Billing",
                      "Adjustment Required",
                      "For Removal",
                      "Removed from Billing",
                    ].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.billingStatus}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Billing Month</p>
              <p className="font-medium">{formatDate(member.lastBillingMonth)}</p>
            </div>
            {canManage && (
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="billing-remarks" className="text-xs text-muted-foreground">
                  Billing Remarks
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    id="billing-remarks"
                    value={billingRemarks}
                    onChange={(e) => setBillingRemarks(e.target.value)}
                    rows={2}
                  />
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => patch({ billingRemarks })}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrollment & Card</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Enrollment Status</p>
              {canManage ? (
                <Select
                  value={member.enrollmentStatus}
                  onValueChange={(v) => patch({ enrollmentStatus: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_ENROLLMENT_STATUSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.enrollmentStatus}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date Endorsed to ETIQA</p>
              <p className="font-medium">{formatDate(member.dateEndorsedToEtiqa)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">HMO Effectivity Date</p>
              <p className="font-medium">{formatDate(member.hmoEffectivityDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requirements Complete</p>
              <p className="font-medium">{member.requirementsComplete ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Virtual Card</p>
              {canManage ? (
                <Select
                  value={member.virtualCardStatus}
                  onValueChange={(v) => patch({ virtualCardStatus: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_VIRTUAL_CARD_STATUSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.virtualCardStatus}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Physical Card</p>
              {canManage ? (
                <Select
                  value={member.physicalCardStatus}
                  onValueChange={(v) => patch({ physicalCardStatus: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_PHYSICAL_CARD_STATUSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.physicalCardStatus}</p>
              )}
            </div>
            {canManage && (
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="enrollment-remarks" className="text-xs text-muted-foreground">
                  Enrollment Remarks
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    id="enrollment-remarks"
                    value={enrollmentRemarks}
                    onChange={(e) => setEnrollmentRemarks(e.target.value)}
                    rows={2}
                  />
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => patch({ enrollmentRemarks })}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Offboarding / Removal</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Removal Required</p>
              <p className="font-medium">{member.removalRequired ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Removal Status</p>
              {canManage ? (
                <Select
                  value={member.removalStatus}
                  onValueChange={(v) => patch({ removalStatus: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_REMOVAL_STATUSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.removalStatus}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inactive Date</p>
              <p className="font-medium">{formatDate(member.inactiveDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inactive Reason</p>
              {canManage ? (
                <Select
                  value={member.inactiveReason || ""}
                  onValueChange={(v) => patch({ inactiveReason: v })}
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_INACTIVE_REASONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.inactiveReason ?? "—"}</p>
              )}
            </div>
            {canManage && (
              <div className="col-span-2 grid gap-1.5 sm:col-span-4">
                <Label htmlFor="removal-remarks" className="text-xs text-muted-foreground">
                  Removal Remarks
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    id="removal-remarks"
                    value={removalRemarks}
                    onChange={(e) => setRemovalRemarks(e.target.value)}
                    rows={2}
                  />
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => patch({ removalRemarks })}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          {!activityLogs || activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 border-b pb-2 text-sm last:border-0"
                >
                  <div>
                    <p>{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.actor}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
