import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Lock, Pencil, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

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
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees, useUpdateEmployee, useDeleteEmployee } from "@/data/employee-store";
import {
  DEPARTMENTS,
  OFFICES,
  POSITIONS,
  STATUSES,
  formatDate,
  type Employee,
  type EmployeeStatus,
} from "@/data/employees";

// Not real security — a lightweight gate so casual visitors don't stumble into
// bulk-edit tools. Swap for a real auth check once the app is backed by a database.
const MANAGE_PASSWORD = "Gemma";

type SortKey = "id" | "name" | "office" | "department" | "position" | "birthday" | "status";

const statusVariant: Record<EmployeeStatus, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Resigned: "secondary",
  Terminated: "destructive",
};

export function ManageEmployeesDialog() {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const rows = useEmployees();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });

  const [editing, setEditing] = useState<Employee | null>(null);
  const [pendingSave, setPendingSave] = useState<Employee | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? rows
      : rows.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q) ||
            e.position.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q),
        );
    return [...matched].sort((a, b) => {
      const av = String(a[sort.key as keyof Employee] ?? "");
      const bv = String(b[sort.key as keyof Employee] ?? "");
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [rows, query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  function handleUnlock() {
    if (password === MANAGE_PASSWORD) {
      setUnlocked(true);
      setPasswordError(false);
      setPassword("");
    } else {
      setPasswordError(true);
    }
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset the gate every time the dialog closes.
      setUnlocked(false);
      setPassword("");
      setPasswordError(false);
      setQuery("");
    }
  }

  // Editing captures the change, but doesn't commit it — that happens after
  // the confirmation step below, so a save always requires a deliberate second click.
  function requestSave(updated: Employee) {
    setEditing(null);
    setPendingSave(updated);
  }

  async function confirmSave() {
    if (!pendingSave) return;
    try {
      await updateMutation.mutateAsync(pendingSave);
      toast.success(`${pendingSave.name} updated`);
    } catch (error) {
      console.error(error);
      toast.error(`Couldn't save changes to ${pendingSave.name}. Please try again.`);
    } finally {
      setPendingSave(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      toast.success(`${pendingDelete.name} removed`);
    } catch (error) {
      console.error(error);
      toast.error(`Couldn't remove ${pendingDelete.name}. Please try again.`);
    } finally {
      setPendingDelete(null);
    }
  }

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortKey)}
      className="inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:text-primary/80"
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" /> Manage Employees
          </Button>
        </DialogTrigger>

        {!unlocked ? (
          <DialogContent className="sm:max-w-sm">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Manage Employees</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the workspace password to edit or remove employee records.
                </p>
              </div>
              <div className="grid w-full gap-2 pt-2 text-left">
                <Label htmlFor="manage-password">Password</Label>
                <Input
                  id="manage-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  autoFocus
                />
                {passwordError && (
                  <p className="text-xs text-destructive">Incorrect password. Try again.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleUnlock}>Unlock</Button>
            </DialogFooter>
          </DialogContent>
        ) : (
          <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden p-0 sm:max-w-6xl">
            <div className="space-y-3 border-b px-6 py-4">
              <div>
                <h2 className="text-base font-semibold">Manage Employees</h2>
                <p className="text-sm text-muted-foreground">
                  Edit or remove records. Changes save immediately.
                </p>
              </div>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID, position or department..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                    <TableHead><SortHeader label="Employee ID" sortKey="id" /></TableHead>
                    <TableHead><SortHeader label="Full Name" sortKey="name" /></TableHead>
                    <TableHead><SortHeader label="Office" sortKey="office" /></TableHead>
                    <TableHead><SortHeader label="Department" sortKey="department" /></TableHead>
                    <TableHead><SortHeader label="Position" sortKey="position" /></TableHead>
                    <TableHead><SortHeader label="Birthday" sortKey="birthday" /></TableHead>
                    <TableHead><SortHeader label="Status" sortKey="status" /></TableHead>
                    <TableHead className="text-primary">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No employees match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.id}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{e.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.office}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.department}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.position}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(e.birthday)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[e.status]}>{e.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditing(e)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-7 w-7"
                            onClick={() => setPendingDelete(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t px-6 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length} of {rows.length} employees
              </p>
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {editing && (
        <EditEmployeeDialog
          employee={editing}
          onCancel={() => setEditing(null)}
          onRequestSave={requestSave}
        />
      )}

      <AlertDialog open={!!pendingSave} onOpenChange={(o) => !o && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Save changes to {pendingSave?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm you want to apply these changes to this employee's record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditing(pendingSave)}>
              Back to edit
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Confirm & Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Remove {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {pendingDelete?.id} from the directory. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removing..." : "Confirm & Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditEmployeeDialog({
  employee,
  onCancel,
  onRequestSave,
}: {
  employee: Employee;
  onCancel: () => void;
  onRequestSave: (updated: Employee) => void;
}) {
  const [form, setForm] = useState<Employee>(employee);

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-3xl">
        <div className="pb-2">
          <h2 className="text-base font-semibold">Edit Employee Record</h2>
          <p className="text-sm text-muted-foreground">{employee.name}</p>
        </div>

        <div className="space-y-6 py-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-id">Employee ID</Label>
                <Input id="edit-id" value={form.id} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-birthday">Birthday</Label>
                <Input
                  id="edit-birthday"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-start">Start Date</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Employment Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Office Location</Label>
                <Select value={form.office} onValueChange={(v) => setForm({ ...form, office: v })}>
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
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => setForm({ ...form, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Position</Label>
                <Select
                  value={form.position}
                  onValueChange={(v) => setForm({ ...form, position: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-job-offer-date">Job Offer Date</Label>
                <Input
                  id="edit-job-offer-date"
                  type="date"
                  value={form.jobOfferDate ?? ""}
                  onChange={(e) => setForm({ ...form, jobOfferDate: e.target.value || undefined })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Status</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as EmployeeStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-exit">Date Resigned</Label>
                <Input
                  id="edit-exit"
                  type="date"
                  value={form.exitDate ?? ""}
                  onChange={(e) => setForm({ ...form, exitDate: e.target.value || undefined })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onRequestSave(form)}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
