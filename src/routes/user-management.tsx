import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsQuery, useUpdateAccount } from "@/data/account-store";
import { useCurrentAccount, type AccountRole } from "@/lib/session";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";

export const Route = createFileRoute("/user-management")({
  head: () => ({
    meta: [
      { title: "User Management — TGO Workforce" },
      {
        name: "description",
        content:
          "Manage sign-in roles and access for the TGO Workforce portal.",
      },
      { property: "og:title", content: "User Management — TGO Workforce" },
      {
        property: "og:description",
        content: "Admin-only: promote, demote or deactivate portal accounts.",
      },
    ],
  }),
  component: UserManagementPage,
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

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function UserManagementPage() {
  const { data: currentAccount, isLoading: currentLoading } =
    useCurrentAccount();
  const isAdmin = currentAccount?.role === "admin";

  const accountsQuery = useAccountsQuery(isAdmin);
  const updateAccount = useUpdateAccount();

  if (currentLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Management"
          description="Manage roles and access."
        />
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Management"
          description="Manage roles and access."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Admins only</p>
              <p className="text-sm text-muted-foreground">
                Your account (
                {currentAccount
                  ? ROLE_LABELS[currentAccount.role]
                  : "signed out"}
                ) doesn't have access to this page. Ask an existing admin to
                promote you if you need it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accounts = accountsQuery.data ?? [];
  const admins = accounts.filter((a) => a.role === "admin").length;
  const active = accounts.filter((a) => a.isActive).length;

  async function handleRoleChange(accountId: string, role: AccountRole) {
    try {
      await updateAccount.mutateAsync({ id: accountId, patch: { role } });
      toast.success("Role updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update role",
      );
    }
  }

  async function handleActiveToggle(accountId: string, isActive: boolean) {
    try {
      await updateAccount.mutateAsync({ id: accountId, patch: { isActive } });
      toast.success(isActive ? "Account reactivated" : "Account deactivated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update account",
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Everyone who has signed in via Zoho, and what they can do here."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Total Accounts"
          value={accounts.length}
          hint="Ever signed in"
          icon={Users}
        />
        <MetricCard
          title="Admins"
          value={admins}
          hint="Full access"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Active"
          value={active}
          hint="Not deactivated"
          icon={UserCheck}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Change a role or deactivate access below — changes apply immediately
            and are logged to Activity Logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountsQuery.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading accounts...
                  </TableCell>
                </TableRow>
              ) : accountsQuery.isError ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Couldn't load accounts. Try refreshing the page.
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No one has signed in yet.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
                  const isSelf = account.id === currentAccount?.id;
                  const displayName =
                    account.displayName ||
                    [account.firstName, account.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    account.email;

                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {account.photoUrl && (
                              <AvatarImage
                                src={account.photoUrl}
                                alt={displayName}
                              />
                            )}
                            <AvatarFallback className="text-xs">
                              {initials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {displayName}{" "}
                              {isSelf && (
                                <span className="text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {account.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={account.role}
                          disabled={isSelf || updateAccount.isPending}
                          onValueChange={(value) =>
                            handleRoleChange(account.id, value as AccountRole)
                          }
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={account.isActive}
                            disabled={isSelf || updateAccount.isPending}
                            onCheckedChange={(checked) =>
                              handleActiveToggle(account.id, checked)
                            }
                          />
                          <Badge
                            variant={account.isActive ? "default" : "secondary"}
                          >
                            {account.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(account.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDateTime(account.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
