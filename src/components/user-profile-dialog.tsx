// Admin-facing profile view for an arbitrary account — opened from the
// Accounts table in user-management.tsx. Composes entirely from data already
// fetched elsewhere in the app (no new backend endpoints):
//  - Role & Access: usePermissionMatrixQuery's role→permission matrix, looked
//    up for this account's role (Super Admin only — the endpoint 403s anyone
//    else, so it's gated on `canViewMatrix` instead of firing and failing).
//  - Login History / Activity Logs: useMyActivityLogs(accountId), despite its
//    "my" name it's fully generic (GET /activity-logs?account_id=...) and is
//    split client-side by whether `action` looks like a sign-in event.
import { type ReactNode, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Account } from "@/data/account-api";
import {
  useMyActivityLogs,
  type ActivityLogEntry,
  type ActivitySeverity,
} from "@/data/activity-log-store";
import { usePermissionMatrixQuery } from "@/data/permission-store";
import { isFullAccessRole } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";

const SEVERITY_VARIANT: Record<ActivitySeverity, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warning: "outline",
  critical: "destructive",
};

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

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

// The backend logs sign-in attempts under category=Access with these action
// prefixes (see backend/app/api/routes/auth.py's record_activity calls) —
// there's no dedicated "login" category, so this is how the Login History
// tab tells those rows apart from everything else in Activity Logs.
function isSignInEvent(action: string) {
  return action.toLowerCase().startsWith("sign");
}

function ActivityList({
  logs,
  loading,
  emptyText,
}: {
  logs: ActivityLogEntry[];
  loading: boolean;
  emptyText: string;
}) {
  if (loading) return <p className="py-6 text-sm text-muted-foreground">Loading…</p>;
  if (logs.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="max-h-80 space-y-3 overflow-y-auto py-1">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{log.action}</p>
            <p className="truncate text-xs text-muted-foreground">
              {log.target} · {log.timestamp}
            </p>
          </div>
          <Badge variant={SEVERITY_VARIANT[log.severity]} className="shrink-0 capitalize">
            {log.category}
          </Badge>
        </div>
      ))}
    </div>
  );
}

export function UserProfileDialog({
  account,
  canViewMatrix,
  children,
}: {
  account: Account;
  /** Gate the Super-Admin-only permission matrix fetch on the *viewer's* own
   * role, not the target account's — an Admin (not Super Admin) opening
   * another Admin's profile still can't see the matrix. */
  canViewMatrix: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const displayName =
    account.displayName ||
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.email;

  const matrixQuery = usePermissionMatrixQuery(open && canViewMatrix);
  const activityQuery = useMyActivityLogs(open ? account.id : undefined, 100);

  const activity = activityQuery.data ?? [];
  const loginHistory = activity.filter((log) => isSignInEvent(log.action));
  const generalActivity = activity.filter((log) => !isSignInEvent(log.action));

  const fullAccess = isFullAccessRole(account.role);
  const roleEntry = matrixQuery.data?.roles.find((r) => r.role === account.role);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <HoverCard openDelay={250} closeDelay={100}>
        <HoverCardTrigger asChild>
          <DialogTrigger asChild>{children}</DialogTrigger>
        </HoverCardTrigger>
        <HoverCardContent className="w-72">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {account.photoUrl && <AvatarImage src={account.photoUrl} alt={displayName} />}
              <AvatarFallback className="text-xs">{initials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{account.email}</p>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="gap-1 font-normal">
                <ShieldCheck className="h-3 w-3" /> {ROLE_LABELS[account.role]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span>
                {account.isActive ? "Active" : "Inactive"}
                {account.isRestricted ? " · View-only" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last sign-in</span>
              <span>{formatDateTime(account.lastLoginAt)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Click to view full profile</p>
        </HoverCardContent>
      </HoverCard>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {account.photoUrl && <AvatarImage src={account.photoUrl} alt={displayName} />}
              <AvatarFallback>{initials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">{displayName}</DialogTitle>
              <DialogDescription className="truncate">{account.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="access">
          <TabsList>
            <TabsTrigger value="access">Role & Access</TabsTrigger>
            <TabsTrigger value="logins">Login History</TabsTrigger>
            <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> {ROLE_LABELS[account.role]}
              </Badge>
              <Badge variant={account.isActive ? "default" : "secondary"}>
                {account.isActive ? "Active" : "Inactive"}
              </Badge>
              {account.isRestricted && (
                <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3" /> View-only
                </Badge>
              )}
            </div>

            {fullAccess ? (
              <p className="text-sm text-muted-foreground">
                {ROLE_LABELS[account.role]} bypasses the permission matrix entirely — full access to
                every module.
              </p>
            ) : !canViewMatrix ? (
              <p className="text-sm text-muted-foreground">
                Detailed permission grants are only visible to Super Admins.
              </p>
            ) : matrixQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading permissions…</p>
            ) : (
              <div className="space-y-1.5">
                {(matrixQuery.data?.permissions ?? []).map((perm) => {
                  const granted = roleEntry?.permissions.includes(perm.key) ?? false;
                  return (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{perm.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                      <Badge variant={granted ? "default" : "secondary"} className="shrink-0">
                        {granted ? "Granted" : "Not granted"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logins">
            <ActivityList
              logs={loginHistory}
              loading={activityQuery.isLoading}
              emptyText="No sign-in activity recorded yet."
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityList
              logs={generalActivity}
              loading={activityQuery.isLoading}
              emptyText="Nothing recorded yet."
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
