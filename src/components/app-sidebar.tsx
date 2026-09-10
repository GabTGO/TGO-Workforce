import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  UserPlus,
  Award,
  Cake,
  ScrollText,
  Settings,
  UserCog,
  ClipboardCheck,
  ShieldAlert,
  FileBarChart,
} from "lucide-react";

import logoLight from "@/assets/tgo-logo-light.png";
import logoDark from "@/assets/tgo-logo-dark.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentAccount } from "@/lib/session";
import type { Permission } from "@/lib/session";
import { getEffectiveRole, isFullAccessRole, hasPermission } from "@/lib/permissions";

type NavItem = {
  title: string;
  url: NonNullable<LinkProps["to"]>;
  icon: LucideIcon;
  /** Hidden from the nav for every role except "admin"/"super_admin" — the
   * route itself also checks this (and the backend 403s regardless), this
   * just keeps everyone else from seeing a link to a page they can't use. */
  adminOnly?: boolean;
  /** Hidden unless the signed-in account's permission matrix grants this —
   * see @/lib/permissions' hasPermission. Module-level view gating, driven
   * by the Super-Admin-editable matrix rather than a fixed role list. */
  permission?: Permission;
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      // Admin/Super Admin-only: Analytics rolls up numbers across every
      // module (Employee Directory, Onboarding, Attendance), which no single
      // module-siloed role should see in full — see app/routes/analytics.tsx's
      // own isFullAccessRole gate, which enforces this independent of what
      // the nav shows.
      { title: "Analytics", url: "/analytics", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Employee Directory", url: "/directory", icon: Users, permission: "employees.view" },
      { title: "New Hires", url: "/new-hires", icon: UserPlus, permission: "employees.view" },
      { title: "Onboarding", url: "/onboarding", icon: ClipboardCheck, permission: "onboarding.view" },
    ],
  },
  {
    label: "Milestones",
    items: [
      { title: "Anniversaries", url: "/anniversaries", icon: Award },
      { title: "Birthdays", url: "/birthdays", icon: Cake },
    ],
  },
  {
    label: "Attendance",
    items: [
      { title: "Violations", url: "/attendance-violations", icon: ShieldAlert, permission: "attendance.view" },
      { title: "Reports", url: "/attendance-reports", icon: FileBarChart, permission: "attendance.view" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Activity Logs", url: "/activity-logs", icon: ScrollText },
      {
        title: "User Management",
        url: "/user-management",
        icon: UserCog,
        adminOnly: true,
      },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: account } = useCurrentAccount();
  const isAdmin = isFullAccessRole(getEffectiveRole(account));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <img
            src={logoLight}
            alt="Torero Global Outsourcing logo"
            width={1000}
            height={521}
            className="h-10 w-auto shrink-0 object-contain dark:hidden"
          />
          <img
            src={logoDark}
            alt=""
            aria-hidden
            width={1000}
            height={521}
            className="hidden h-10 w-auto shrink-0 object-contain dark:block"
          />

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                Torero Global Outsourcing
              </p>
              <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                HR Operations
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items
                  .filter(
                    (item) =>
                      (!item.adminOnly || isAdmin) &&
                      (!item.permission || hasPermission(account?.permissions, item.permission)),
                  )
                  .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={pathname === item.url}
                      >
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border" />
    </Sidebar>
  );
}
