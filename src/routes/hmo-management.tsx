// Employee Benefits — HMO Management. Placeholder page: the module itself
// (what an HMO record actually holds, who can do what to it) hasn't been
// scoped yet, so this deliberately only wires up the nav item, the
// benefits.view/benefits.manage permission-matrix rows, and an access-gated
// blank page. See @/lib/permissions' canViewBenefits/canManageBenefits and
// backend/app/models/permission.py's Permission.BENEFITS_VIEW.
import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { canViewBenefits } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { useCurrentAccount } from "@/lib/session";

export const Route = createFileRoute("/hmo-management")({
  head: () => ({
    meta: [
      { title: "HMO Management — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Employee Benefits: HMO Management.",
      },
    ],
  }),
  component: HmoManagementPage,
});

function HmoManagementPage() {
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewBenefits(account?.permissions);

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
      <PageHeader title="HMO Management" description="Employee Benefits." />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <HeartPulse className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Coming soon</p>
            <p className="text-sm text-muted-foreground">
              HMO Management is on the way — this page will show enrollment, plan and coverage
              details once the module is scoped.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
