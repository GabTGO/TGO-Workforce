import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Pencil, Plus, ShieldAlert, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { AwardFormDialog } from "@/components/award-form-dialog";
import { MetricCard } from "@/components/metric-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Award } from "@/data/award-api";
import { useAwardsQuery, useDeleteAward } from "@/data/award-store";
import { formatDate, parseCalendarDate } from "@/data/employees";
import { canManageAwards, canViewAwards } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { useCurrentAccount } from "@/lib/session";

export const Route = createFileRoute("/awards")({
  head: () => ({
    meta: [
      { title: "Recognition & Awards — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Give and track employee recognition awards across TGO delivery hubs.",
      },
      { property: "og:title", content: "Recognition & Awards — Torero Global Outsourcing HR Operations" },
      {
        property: "og:description",
        content: "Recognize active employees and keep a record of every award given.",
      },
    ],
  }),
  component: AwardsPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function AwardsPage() {
  const { data: account, isLoading: accountLoading } = useCurrentAccount();
  const canView = canViewAwards(account?.permissions);
  const canManage = canManageAwards(account?.permissions);

  const { data, isLoading, isError } = useAwardsQuery(canView);
  const awards = data ?? [];
  const deleteMutation = useDeleteAward();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Award | null>(null);
  const [deleting, setDeleting] = useState<Award | null>(null);

  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const thisMonthCount = awards.filter(
    (a) => parseCalendarDate(a.awardedDate).toLocaleString("en-US", { month: "long" }) === currentMonthName,
  ).length;
  const uniqueRecipients = new Set(awards.map((a) => a.employeeId)).size;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(`Removed "${deleting.title}"`);
      setDeleting(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't delete this award. Please try again.");
    }
  }

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recognition & Awards"
          description="Give and track employee recognition awards."
        />
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recognition & Awards"
          description="Give and track employee recognition awards."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No access</p>
              <p className="text-sm text-muted-foreground">
                Your account ({account ? ROLE_LABELS[account.role] : "signed out"}) doesn't have
                access to Recognition & Awards. Ask a Super Admin to grant it from the permission
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
        title="Recognition & Awards"
        description="Give and track employee recognition awards."
        action={
          canManage ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Give an Award
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Total Awards" value={awards.length} hint="All time" icon={Trophy} />
        <MetricCard
          title="This Month"
          value={thisMonthCount}
          hint={`Given in ${currentMonthName}`}
          icon={Trophy}
        />
        <MetricCard
          title="Employees Recognized"
          value={uniqueRecipients}
          hint="Unique recipients"
          icon={Trophy}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Awards</CardTitle>
          <CardDescription>Most recent first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Award</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Given By</TableHead>
                  {canManage && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-muted-foreground">
                      Loading awards...
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-muted-foreground">
                      Couldn't load awards. Try refreshing the page.
                    </TableCell>
                  </TableRow>
                ) : awards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-muted-foreground">
                      No awards given yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  awards.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">{initials(a.employeeName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{a.employeeName}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.employeeOffice}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{a.title}</p>
                        {a.description && (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">{a.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(a.awardedDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {a.awardedByLabel}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditing(a);
                                setFormOpen(true);
                              }}
                              aria-label={`Edit ${a.title} for ${a.employeeName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleting(a)}
                              aria-label={`Delete ${a.title} for ${a.employeeName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {canManage && (
        <AwardFormDialog
          open={formOpen}
          onOpenChange={(next) => {
            setFormOpen(next);
            if (!next) setEditing(null);
          }}
          award={editing}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete this award?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deleting?.title}" from {deleting?.employeeName}'s record. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
