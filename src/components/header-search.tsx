// Replaces the header's old static breadcrumb with a quick-nav search —
// "where do I go" is a more useful thing to put there than "where am I"
// (the page title right below already says that). Only ever lists pages
// getAccessibleNavItems() says this signed-in account can actually reach —
// same adminOnly/superAdminOnly/permission gating the sidebar itself uses
// (see @/components/app-sidebar), so this is a faster way to reach a page
// already in the nav, never a way to discover one that isn't.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command as CommandPrimitive } from "cmdk";
import { Search, User } from "lucide-react";

import { getAccessibleNavItems, type NavItem } from "@/components/app-sidebar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCurrentAccount } from "@/lib/session";
import { cn } from "@/lib/utils";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export function HeaderSearch() {
  const { data: account } = useCurrentAccount();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Profile isn't in the sidebar (it's reachable from the account menu
  // instead — see @/components/app-shell), but it's a real page every
  // signed-in account can open, so it belongs in "search for a page" too.
  const items = useMemo<NavItem[]>(
    () => [...getAccessibleNavItems(account), { title: "Profile", url: "/profile", icon: User }],
    [account],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function go(url: NavItem["url"]) {
    navigate({ to: url });
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-xs sm:max-w-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          inputRef.current?.blur();
        }
      }}
    >
      <Command shouldFilter className="h-auto w-full overflow-visible rounded-none bg-transparent">
        <div
          className={cn(
            "flex h-9 items-center gap-2 rounded-full border bg-muted/40 px-3 transition-colors",
            open ? "border-primary/40 bg-background ring-2 ring-primary/15" : "hover:bg-muted/60",
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            placeholder="Search pages..."
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {!open && !query && (
            <kbd className="hidden shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
              {IS_MAC ? "⌘K" : "Ctrl K"}
            </kbd>
          )}
        </div>

        {open && (
          <CommandList
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No pages match &quot;{query}&quot;.
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem key={item.url} value={item.title} onSelect={() => go(item.url)}>
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  );
}
