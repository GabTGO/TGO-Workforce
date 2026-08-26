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
} from "lucide-react";

import logoAsset from "@/assets/tgo-logo-light.png.asset.json";
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

type NavItem = {
  title: string;
  url: NonNullable<LinkProps["to"]>;
  icon: LucideIcon;
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Employee Directory", url: "/directory", icon: Users },
      { title: "New Hires", url: "/new-hires", icon: UserPlus },
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
    label: "System",
    items: [
      { title: "Activity Logs", url: "/activity-logs", icon: ScrollText },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <img
            src={logoAsset.url}
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
              <p className="truncate text-sm font-semibold tracking-tight">TGO Workforce</p>
              <p className="truncate text-xs text-muted-foreground">
                Automation and AI Portal Internal operations workspace
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
                {group.items.map((item) => (
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
