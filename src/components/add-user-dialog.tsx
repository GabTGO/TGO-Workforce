// "Add User" — lets an admin pre-assign a role to an email that hasn't
// signed in yet (backend: POST /accounts/invites, app/models/pending_invite.py).
// The next time that person signs in via Zoho, they get this role
// automatically instead of the usual "starts as viewer" default. This sends
// no email or notification of any kind — the app has no outbound-mail
// integration — so the admin still needs to tell that person out-of-band to
// go sign in at the portal.

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
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
import { useCreatePendingInvite } from "@/data/account-store";
import type { AccountRole } from "@/lib/session";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("viewer");
  const createInvite = useCreatePendingInvite();

  function reset() {
    setEmail("");
    setRole("viewer");
  }

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    try {
      await createInvite.mutateAsync({ email: trimmed, role });
      setOpen(false);
      toast.success(
        `${trimmed} will be added as ${ROLE_LABELS[role]} the moment they sign in.`,
      );
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't add this user.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <div className="pb-2">
          <h2 className="text-lg font-semibold">Add User</h2>
          <p className="text-sm text-muted-foreground">
            Pre-assign a role to someone who hasn't signed in yet. They'll get
            it automatically the first time they sign in via Zoho — this doesn't
            send them anything, so let them know to go sign in.
          </p>
        </div>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="add-user-email">Email</Label>
            <Input
              id="add-user-email"
              type="email"
              placeholder="name@tgo.internal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as AccountRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createInvite.isPending}>
            {createInvite.isPending ? "Adding..." : "Add User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
