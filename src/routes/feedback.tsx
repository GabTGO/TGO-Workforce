import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Lightbulb,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Rocket,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { FeedbackFormDialog } from "@/components/feedback-form-dialog";
import { FeedbackThreadDialog } from "@/components/feedback-thread-dialog";
import { MultiSelectFilter } from "@/components/multi-select-filter";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Feedback, FeedbackPriority, FeedbackStatus, FeedbackType } from "@/data/feedback-api";
import { useDeleteFeedback, useFeedbackQuery, useUpdateFeedback } from "@/data/feedback-store";
import { getEffectiveRole, isSuperAdminRole } from "@/lib/permissions";
import { useCurrentAccount } from "@/lib/session";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — Torero Global Outsourcing HR Operations" },
      {
        name: "description",
        content: "Report a bug or suggest an improvement, and track it through triage.",
      },
      { property: "og:title", content: "Feedback — Torero Global Outsourcing HR Operations" },
      {
        property: "og:description",
        content: "A Kanban board of bug reports and improvement suggestions.",
      },
    ],
  }),
  component: FeedbackPage,
});

const COLUMNS: { status: FeedbackStatus; label: string; icon: typeof Circle }[] = [
  { status: "pending", label: "Pending", icon: Circle },
  { status: "working_on_it", label: "Working On It", icon: Wrench },
  { status: "resolved", label: "Resolved", icon: CheckCircle2 },
  { status: "implemented", label: "Implemented", icon: Rocket },
];

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: "Pending",
  working_on_it: "Working On It",
  resolved: "Resolved",
  implemented: "Implemented",
};

const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug",
  improvement: "Improvement",
};

// Cards per column, per page — a Kanban card is visually bigger than a
// table row, so this stays smaller than the ~8-15 row-size pagination used
// on the Directory/Activity Logs tables.
const PAGE_SIZE = 6;

// Amber for High (a "worth escalating soon" warning, not yet critical) and
// the destructive token for Urgent — same amber/destructive convention used
// everywhere else in this app for status severity.
const PRIORITY_BADGE_CLASS: Record<FeedbackPriority, string> = {
  low: "",
  medium: "",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  urgent: "",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function FeedbackCard({ item, canTriage }: { item: Feedback; canTriage: boolean }) {
  const updateMutation = useUpdateFeedback();
  const deleteMutation = useDeleteFeedback();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  // Same rule as the backend's _can_access_thread: the card's own reporter,
  // or Super Admin — everyone else never sees this entry point at all.
  const canOpenThread = canTriage || item.isOwn;

  async function handleStatusChange(status: FeedbackStatus) {
    try {
      await updateMutation.mutateAsync({ id: item.id, patch: { status } });
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't move that card. Please try again.");
    }
  }

  async function handlePriorityChange(priority: FeedbackPriority) {
    try {
      await updateMutation.mutateAsync({ id: item.id, patch: { priority } });
      toast.success(`Priority set to ${PRIORITY_LABELS[priority]}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't update priority. Please try again.");
    }
  }

  async function confirmDelete() {
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success("Removed from the board");
      setConfirmingDelete(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't delete this. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          {canTriage && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={item.type === "bug" ? "destructive" : "outline"}
            className={item.type === "improvement" ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400" : undefined}
          >
            {item.type === "bug" ? (
              <Bug className="mr-1 h-3 w-3" />
            ) : (
              <Lightbulb className="mr-1 h-3 w-3" />
            )}
            {item.type === "bug" ? "Bug" : "Improvement"}
          </Badge>
          <Badge
            variant={item.priority === "urgent" ? "destructive" : "secondary"}
            className={PRIORITY_BADGE_CLASS[item.priority] || undefined}
          >
            {PRIORITY_LABELS[item.priority]} priority
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm text-muted-foreground">{item.reason}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          {item.reportedByLabel && (
            <span className="flex items-center gap-1">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary">
                {initials(item.reportedByLabel)}
              </span>
              {item.reportedByLabel}
            </span>
          )}
        </div>

        {canOpenThread && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => setThreadOpen(true)}
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            {item.commentCount > 0 ? `${item.commentCount} repl${item.commentCount === 1 ? "y" : "ies"}` : "Reply"}
          </Button>
        )}

        {canTriage && (
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <Select value={item.status} onValueChange={(v) => handleStatusChange(v as FeedbackStatus)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => (
                  <SelectItem key={c.status} value={c.status}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={item.priority} onValueChange={(v) => handlePriorityChange(v as FeedbackPriority)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as FeedbackPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{item.title}" from the board. This can't be undone.
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
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canOpenThread && (
        <FeedbackThreadDialog item={item} open={threadOpen} onOpenChange={setThreadOpen} />
      )}
    </Card>
  );
}

const EMPTY_PAGE_STATE: Record<FeedbackStatus, number> = {
  pending: 1,
  working_on_it: 1,
  resolved: 1,
  implemented: 1,
};

function FeedbackPage() {
  const { data: account } = useCurrentAccount();
  const canTriage = isSuperAdminRole(getEffectiveRole(account));
  const { data, isLoading, isError } = useFeedbackQuery();
  const items = data ?? [];
  const [formOpen, setFormOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  // One page number per column — moving to page 2 of Pending shouldn't
  // affect Resolved's own position.
  const [page, setPage] = useState<Record<FeedbackStatus, number>>(EMPTY_PAGE_STATE);

  const resetPages = () => setPage(EMPTY_PAGE_STATE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !q || item.title.toLowerCase().includes(q) || item.reason.toLowerCase().includes(q);
      const matchesType = typeFilter.length === 0 || typeFilter.includes(item.type);
      const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(item.priority);
      return matchesQuery && matchesType && matchesPriority;
    });
  }, [items, query, typeFilter, priorityFilter]);

  const hasActiveFilters = query.trim() !== "" || typeFilter.length > 0 || priorityFilter.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description={
          canTriage
            ? "Every report and suggestion — triage status, priority, and see who submitted each one."
            : "Report a bug or suggest an improvement, and track it through triage."
        }
        action={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" /> Report Feedback
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPages();
            }}
            placeholder="Search title or reason..."
            className="pl-8"
          />
        </div>
        <MultiSelectFilter
          label="Type"
          selected={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            resetPages();
          }}
          options={Object.keys(TYPE_LABELS)}
        />
        <MultiSelectFilter
          label="Priority"
          selected={priorityFilter}
          onChange={(v) => {
            setPriorityFilter(v);
            resetPages();
          }}
          options={Object.keys(PRIORITY_LABELS)}
        />
        {hasActiveFilters && (
          <span className="text-xs text-muted-foreground">
            Showing {filtered.length} of {items.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading feedback…</p>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">Couldn't load feedback. Try refreshing the page.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnItems = filtered.filter((i) => i.status === column.status);
            const pageCount = Math.max(1, Math.ceil(columnItems.length / PAGE_SIZE));
            const currentPage = Math.min(page[column.status], pageCount);
            const pageItems = columnItems.slice(
              (currentPage - 1) * PAGE_SIZE,
              currentPage * PAGE_SIZE,
            );
            const Icon = column.icon;
            return (
              <div key={column.status} className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{column.label}</p>
                  <Badge variant="secondary" className="ml-auto">
                    {columnItems.length}
                  </Badge>
                </div>
                <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                  {pageItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      {columnItems.length === 0 && hasActiveFilters
                        ? "No matches in this column."
                        : "Nothing here yet."}
                    </p>
                  ) : (
                    pageItems.map((item) => (
                      <FeedbackCard key={item.id} item={item} canTriage={canTriage} />
                    ))
                  )}
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage((p) => ({ ...p, [column.status]: currentPage - 1 }))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {currentPage} of {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === pageCount}
                      onClick={() => setPage((p) => ({ ...p, [column.status]: currentPage + 1 }))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FeedbackFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
