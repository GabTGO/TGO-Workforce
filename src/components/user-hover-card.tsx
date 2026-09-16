// Quick-info preview shown when hovering an account row in
// user-management.tsx's Accounts table — the full profile lives at its own
// route (/user-management/$accountId), not a dialog, so this component is
// just the HoverCard wrapper around whatever trigger (a Link, usually) is
// passed as children.
import { type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import type { Account } from "@/data/account-api";
import { ROLE_LABELS } from "@/lib/roles";

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

export function UserHoverCard({ account, children }: { account: Account; children: ReactNode }) {
  const displayName =
    account.displayName ||
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.email;

  return (
    <HoverCard openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
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
  );
}
