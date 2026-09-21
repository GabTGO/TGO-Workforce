// A Select that also lets someone type a brand-new value the fixed preset
// list doesn't have — Department/Position/Level are plain free-text fields
// on the Employee model already (see @/data/employees), so this list is
// just presets to pick from quickly, not a closed enum the backend enforces.
// Typing something that matches no preset swaps the empty state for an
// "Add "<value>"" action instead.
//
// The preset list itself is editable too (rename/delete a suggestion,
// hovering a row) — shared org-wide via /list-options (see
// backend/app/api/routes/list_options.py), not per-browser. Renaming/
// deleting a preset requires the same manage password as every other
// destructive action in the Manage Employees dialog, so a stray click can't
// silently change what every other edit shows as a suggestion; adding a new
// one doesn't, since that's purely additive and easy to just delete back
// out. Used from both the Edit Employee form and the New Hire form, so any
// admin-managed preset list (departments, positions, levels, ...) gets the
// exact same add/rename/delete UI wherever it's picked.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ListKey } from "@/data/list-options-api";
import {
  useAddListOption,
  useRemoveListOption,
  useRenameListOption,
} from "@/data/list-options-store";
import { MANAGE_PASSWORD } from "@/lib/manage-password";
import { cn } from "@/lib/utils";

export function CreatableComboboxField({
  label,
  listKey,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  listKey: ListKey;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const addOption = useAddListOption();
  const renameOption = useRenameListOption();
  const removeOption = useRemoveListOption();
  const busy = addOption.isPending || renameOption.isPending || removeOption.isPending;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamePassword, setRenamePassword] = useState("");
  const [renamePasswordError, setRenamePasswordError] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState(false);

  // A custom value from a previous "Add" stays selectable (and shown as
  // selected) even though it isn't one of the current presets.
  const allOptions = useMemo(
    () => (value && !options.includes(value) ? [...options, value] : options),
    [options, value],
  );

  async function handleAdd(rawValue: string) {
    const trimmed = rawValue.trim();
    try {
      await addOption.mutateAsync({ listKey, value: trimmed });
      onChange(trimmed);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that. Please try again.");
    }
  }

  function startRename(option: string) {
    setOpen(false);
    setRenameTarget(option);
    setRenameValue(option);
  }

  async function confirmRename() {
    if (!renameTarget) return;
    if (renamePassword !== MANAGE_PASSWORD) {
      setRenamePasswordError(true);
      return;
    }
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error(`Give this ${label.toLowerCase()} a name.`);
      return;
    }
    try {
      await renameOption.mutateAsync({ listKey, oldValue: renameTarget, newValue: trimmed });
      if (value === renameTarget) onChange(trimmed);
      toast.success(`Renamed to "${trimmed}"`);
      setRenameTarget(null);
      setRenamePassword("");
      setRenamePasswordError(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename that. Please try again.");
    }
  }

  function startDelete(option: string) {
    setOpen(false);
    setDeleteTarget(option);
  }

  async function confirmDeleteOption() {
    if (!deleteTarget) return;
    if (deletePassword !== MANAGE_PASSWORD) {
      setDeletePasswordError(true);
      return;
    }
    try {
      await removeOption.mutateAsync({ listKey, value: deleteTarget });
      if (value === deleteTarget) onChange("");
      toast.success(`Removed "${deleteTarget}"`);
      setDeleteTarget(null);
      setDeletePassword("");
      setDeletePasswordError(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete that. Please try again.");
    }
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] max-w-[90vw] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={`Search or add a ${label.toLowerCase()}...`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {query.trim() ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => handleAdd(query)}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Add &quot;{query.trim()}&quot;
                  </button>
                ) : (
                  <span className="text-muted-foreground">No matches.</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {allOptions.map((o) => (
                  <CommandItem
                    key={o}
                    value={o}
                    onSelect={() => {
                      onChange(o);
                      setOpen(false);
                    }}
                    className="group justify-between"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === o ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(o);
                        }}
                        aria-label={`Rename ${o}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          startDelete(o);
                        }}
                        aria-label={`Delete ${o}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={!!renameTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRenameTarget(null);
            setRenamePassword("");
            setRenamePasswordError(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename &quot;{renameTarget}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes the suggestion for every future edit — it won't change any employee
              already using this {label.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-2">
              <Label htmlFor={`rename-${listKey}-value`}>New name</Label>
              <Input
                id={`rename-${listKey}-value`}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`rename-${listKey}-password`}>Confirm with password</Label>
              <Input
                id={`rename-${listKey}-password`}
                type="password"
                value={renamePassword}
                onChange={(e) => {
                  setRenamePassword(e.target.value);
                  setRenamePasswordError(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && confirmRename()}
              />
              {renamePasswordError && (
                <p className="text-xs text-destructive">Incorrect password.</p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRename();
              }}
              disabled={busy}
            >
              {renameOption.isPending ? "Renaming..." : "Confirm & Rename"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeletePassword("");
            setDeletePasswordError(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete &quot;{deleteTarget}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes this as a suggested {label.toLowerCase()} going forward. Any employee already
              using it keeps it unchanged — this only affects what's offered here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor={`delete-${listKey}-password`}>Confirm with password</Label>
            <Input
              id={`delete-${listKey}-password`}
              type="password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeletePasswordError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && confirmDeleteOption()}
              autoFocus
            />
            {deletePasswordError && <p className="text-xs text-destructive">Incorrect password.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteOption();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeOption.isPending ? "Deleting..." : "Confirm & Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
