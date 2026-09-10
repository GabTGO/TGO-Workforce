# UI Design Reference

A portable design-system reference extracted from the Torero Global Outsourcing HR Operations app. Stack: **React 19 + TanStack Start/Router + TypeScript + Tailwind v4 + shadcn/ui (Radix primitives) + `sonner` (toasts) + `lucide-react` (icons) + `recharts` (charts)**.

Drop this into a new project as a north star, or copy sections wholesale — the component code below is taken directly from working files, not idealized snippets.

---

## 1. Tech stack & conventions

| Layer | Choice |
|---|---|
| Framework | React 19, TanStack Start (file-based router on Vite + Nitro), TypeScript |
| Styling | Tailwind CSS v4 (`@theme inline` token layer, no `tailwind.config.js`) |
| Component primitives | shadcn/ui — Radix UI under the hood, copied into `src/components/ui/*`, not an npm dependency |
| Server state | `@tanstack/react-query` — every list/detail view is a query hook, every write a mutation hook |
| Icons | `lucide-react`, one import per icon used, `size-4`/`h-4 w-4` by default |
| Toasts | `sonner` — one global `<Toaster />` mounted once at the app root |
| Charts | `recharts`, wrapped in a themeable `ChartContainer` (see §14) |
| Class merging | `cn()` helper (`clsx` + `tailwind-merge`) — always wrap conditional classes in it |
| Variants | `class-variance-authority` (`cva`) for every component with visual variants (Button, Badge, Alert) |
| Forms | Local `useState` per form, no form library for this app's own dialogs — validate inline, disable submit until valid |
| Animations | No JS animation library in practice — `tw-animate-css` utility classes driven by Radix's `data-state` attributes (see §19) |

Folder convention: `src/components/ui/*` = untouched primitives (Button, Dialog, Input...). `src/components/*` = app-specific composites (AppShell, AppSidebar, a specific dialog). Domain logic never lives inside `ui/*`.

### Libraries — what's installed and what each one is for

Exact versions currently pinned in `package.json` — carry the majors forward when porting this to a new project.

```
Core
  react ^19.2.0 / react-dom ^19.2.0        UI runtime
  typescript ^5.8.3                        types
  @tanstack/react-start ^1.168.32          meta-framework: wires the router to a Vite + Nitro server build
  @tanstack/react-router 1.170.18          file-based routing (routes/*.tsx), typed params/loaders
  @tanstack/router-plugin 1.168.23         the Vite plugin that generates the route tree
  @tanstack/react-query ^5.101.1           server-state cache — query hooks for reads, mutation hooks for writes
  vite 8.1.5 / vite-tsconfig-paths          build tool + "@/..." path aliases

Styling & primitives
  tailwindcss ^4.2.1 / @tailwindcss/vite    utility CSS, v4's Vite-native pipeline (no config file)
  tw-animate-css ^1.3.4                     the animate-in/out, fade/zoom/slide utility classes (§19)
  @radix-ui/react-*                         unstyled accessible primitives — dialog, alert-dialog, dropdown-menu,
                                             select, tabs, tooltip, switch, checkbox, avatar, popover, hover-card,
                                             separator, accordion, scroll-area, slider, toggle(-group),
                                             navigation-menu, menubar, context-menu, radio-group, progress,
                                             aspect-ratio, label, slot — shadcn/ui components are these + Tailwind
  class-variance-authority ^0.7.1           cva() — a component's variants (size, variant, intent) as one typed object
  clsx ^2.1.1 / tailwind-merge ^3.5.0        conditional class joining + conflict resolution — always via cn()
  lucide-react ^0.575.0                     icon set (§2's usage rule: size-4, one import per icon)

Feedback & data display
  sonner ^2.0.7                             toast notifications (§10)
  recharts ^2.15.4                          chart primitives, wrapped by ChartContainer (§14)
  date-fns ^4.1.0                           date formatting/math — never hand-roll it

Bigger-need extras (present, used selectively — not every page needs these)
  react-hook-form ^7.71.2 + @hookform/resolvers ^5.2.2 + zod ^3.24.2
                                             for forms that outgrow plain useState (multi-step wizards, complex
                                             validation) — most dialogs in this app still just use useState
  cmdk ^1.1.1                                command-palette / searchable list (shadcn Command)
  vaul ^1.1.2                                mobile bottom-sheet drawer (shadcn Drawer) for touch viewports
  embla-carousel-react ^8.6.0                carousel primitive (shadcn Carousel)
  input-otp ^1.4.2                           one-time-passcode input boxes
  react-day-picker ^9.14.0                   calendar/date-picker primitive (shadcn Calendar)
  react-resizable-panels ^4.6.5              resizable split panes (shadcn Resizable)
  nanoid ^6.0.1                               client-side id generation (optimistic-update temp ids)
  jspdf ^4.2.1 + jspdf-autotable ^5.0.8       client-generated PDF exports (reports)
  xlsx ^0.18.5                                spreadsheet import/export

Installed but NOT used anywhere in this codebase today
  motion ^13.1.1                             the Framer-Motion-successor animation library — every animation this
                                             app actually ships is the CSS/data-state approach in §19. Don't reach
                                             for it as a default; only add real usage if something needs physics-
                                             based drag, shared-layout animation, or scroll-linked motion that CSS
                                             genuinely can't express.
```

---

## 2. Color theme (CSS variables, OKLCH)

Tailwind v4's token layer: raw values live in `:root` / `.dark`, then get re-exposed as `--color-*` inside `@theme inline` so `bg-primary`, `text-muted-foreground`, etc. just work.

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.9816 0.0017 247.8390);
  --foreground: oklch(0.3142 0.0380 249.1171);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3142 0.0380 249.1171);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3142 0.0380 249.1171);
  --primary: oklch(0.7094 0.1067 137.1778);        /* brand green */
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.3142 0.0380 249.1171);       /* dark slate */
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.9683 0.0069 247.8956);
  --muted-foreground: oklch(0.5544 0.0407 257.4166);
  --accent: oklch(0.7094 0.1067 137.1778);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);      /* red */
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9288 0.0126 255.5078);
  --input: oklch(0.9288 0.0126 255.5078);
  --ring: oklch(0.3142 0.0380 249.1171);
  --chart-1: oklch(0.7094 0.1067 137.1778);
  --chart-2: oklch(0.3142 0.0380 249.1171);
  --chart-3: oklch(0.4140 0.0547 248.3609);
  --chart-4: oklch(0.7959 0.0766 139.6826);
  --chart-5: oklch(0.5137 0.0556 243.6587);
  --sidebar: oklch(1.0000 0 0);
  --sidebar-foreground: oklch(0.3142 0.0380 249.1171);
  --sidebar-primary: oklch(0.7094 0.1067 137.1778);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9683 0.0069 247.8956);
  --sidebar-accent-foreground: oklch(0.7094 0.1067 137.1778);
  --sidebar-border: oklch(0.9288 0.0126 255.5078);
  --sidebar-ring: oklch(0.3142 0.0380 249.1171);
  --font-sans: 'Inter', sans-serif;
  --font-serif: 'Merriweather', serif;
  --font-mono: 'Fira Code', monospace;
  --radius: 0.375rem;
  --shadow-color: #000000;
  --shadow-sm: 0px 4px 10px 0px hsl(0 0% 0% / 0.10), 0px 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0px 4px 10px 0px hsl(0 0% 0% / 0.10), 0px 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0px 4px 10px 0px hsl(0 0% 0% / 0.10), 0px 4px 6px -1px hsl(0 0% 0% / 0.10);
  --tracking-normal: 0.05em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.3142 0.0380 249.1171);
  --foreground: oklch(1.0000 0 0);
  --card: oklch(0.3564 0.0391 248.9745);
  --card-foreground: oklch(1.0000 0 0);
  --popover: oklch(0.3142 0.0380 249.1171);
  --popover-foreground: oklch(1.0000 0 0);
  --primary: oklch(0.7094 0.1067 137.1778);         /* same brand green, both modes */
  --primary-foreground: oklch(0.3142 0.0380 249.1171);
  --secondary: oklch(1.0000 0 0);
  --secondary-foreground: oklch(0.3142 0.0380 249.1171);
  --muted: oklch(0.4140 0.0547 248.3609);
  --muted-foreground: oklch(0.7107 0.0351 256.7878);
  --destructive: oklch(0.3958 0.1331 25.7230);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.4140 0.0547 248.3609);
  --input: oklch(0.4140 0.0547 248.3609);
  --ring: oklch(0.7094 0.1067 137.1778);
  --sidebar: oklch(0.2914 0.0357 250.6956);
  --sidebar-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.4140 0.0547 248.3609);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0.4140 0.0547 248.3609);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-border: var(--sidebar-border);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * { border-color: var(--color-border); }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    letter-spacing: var(--tracking-normal);
  }
}
```

**Rules of thumb:**
- Never hardcode a hex color in a component — always a token (`bg-primary`, `text-muted-foreground`, `border-border`).
- Dark mode toggles by adding `.dark` to `<html>` — see `src/lib/theme.ts`'s `applyTheme()`.
- One-off status colors (success/warning banners, "sent" badges) *do* use raw Tailwind palette classes with an explicit dark variant, since they're not part of the token system — e.g. `text-emerald-600 dark:text-emerald-400`, `border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400`. Keep this pattern consistent: `{color}-600 dark:{color}-400` for text, `{color}-500/10` or `/40` for tinted backgrounds/borders.
- `--chart-1` through `--chart-5` are the dedicated palette for data visualization (§13) — don't reuse `--primary`/`--destructive` for chart series, use the chart tokens so a brand-color change doesn't accidentally recolor every graph.

---

## 3. Overall shell layout

Every authenticated page renders inside one shell: a collapsible icon-sidebar + a sticky header (navbar) + `<main>`.

```tsx
<SidebarProvider>
  <div className="flex min-h-screen w-full bg-background">
    <AppSidebar />
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <Breadcrumb>...</Breadcrumb>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <DropdownMenu>...account menu...</DropdownMenu>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  </div>
</SidebarProvider>
```

**Page header pattern** (used at the top of every page body, inside `<main>`):
```tsx
function PageHeader({ title, description, action, badge }: {
  title: string; description: string; action?: ReactNode; badge?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
```
Every route: `<div className="space-y-6"><PageHeader ... action={<Button>...</Button>} /> ...cards/tables... </div>`.

**Standalone routes** (login) skip the shell entirely — the root layout checks the pathname and renders a bare `<Outlet />` instead of `<AppShell>`:
```tsx
const STANDALONE_ROUTES = new Set(["/login"]);
const isStandalone = STANDALONE_ROUTES.has(pathname);
return (
  <QueryClientProvider client={queryClient}>
    {isStandalone ? <Outlet /> : <AppShell><Outlet /></AppShell>}
    <Toaster />
  </QueryClientProvider>
);
```

### Logo

The brand mark ships as **three separate PNG exports**, not one file re-tinted at runtime — swap in your own three files under `src/assets/` and the same code below works unchanged:

| File | Used where | Why a separate export |
|---|---|---|
| `logo-light.png` | Sidebar header, light mode | Reads correctly against the light `--sidebar` surface |
| `logo-dark.png` | Sidebar header, dark mode | A light-mode logo usually loses contrast/detail on a dark surface — a real re-export beats a CSS filter |
| `logo-ondark.png` | Login page's decorative panel (§15) — that panel is a fixed dark color in *both* themes | Independent of the light/dark toggle entirely, since the panel itself never changes color |

**Sidebar header** — both light/dark exports render simultaneously; Tailwind's `dark:` variant toggles which one is visible, so there's no flash or JS branch:
```tsx
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

<img
  src={logoLight}
  alt="Company logo"
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
```
Rules: set real `width`/`height` on both (prevents layout shift while the image loads); only the *visible* one gets the real `alt` text — the hidden counterpart is `alt=""` + `aria-hidden` so a screen reader doesn't announce the same logo twice.

**Login page's decorative panel** (§15) — just the single `ondark` export, since that panel's background never changes with the theme:
```tsx
import logoOnDark from "@/assets/logo-ondark.png";

<img src={logoOnDark} alt="Company" className="h-16 w-auto object-contain" />
```

---

## 4. Sidebar (navigation)

Collapsible icon-rail sidebar, grouped nav items, active-route highlighting, role/permission-gated visibility. Built on a `Sidebar` primitive (context + `SidebarProvider`/`SidebarTrigger`/`useSidebar`) with `collapsible="icon"` — collapses to icons-only with tooltips instead of vanishing.

**Nav data as a plain array** (not JSX) — makes gating trivial and keeps the render function dumb:
```tsx
type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;                 // hidden unless the account is full-access
  permission?: Permission | Permission[]; // hidden unless the account holds this (all, if array)
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Analytics", url: "/analytics", icon: BarChart3, adminOnly: true },
  ]},
  { label: "People", items: [
    { title: "Directory", url: "/directory", icon: Users, permission: "employees.view" },
    { title: "Onboarding", url: "/onboarding", icon: ClipboardCheck, permission: "onboarding.view" },
  ]},
  { label: "System", items: [
    { title: "Activity Logs", url: "/activity-logs", icon: ScrollText },
    { title: "User Management", url: "/user-management", icon: UserCog, adminOnly: true },
    { title: "Settings", url: "/settings", icon: Settings },
  ]},
];
```

**Render** — filter items per group *before* deciding whether to render the group at all, so a fully-hidden group doesn't leave a floating, item-less label behind:
```tsx
function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: account } = useCurrentAccount();
  const isAdmin = isFullAccessRole(account?.role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-10 w-auto shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Company Name</p>
              <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">Product</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => (!item.adminOnly || isAdmin) && (!item.permission || hasPermission(account?.permissions, item.permission)),
          );
          if (visibleItems.length === 0) return null; // skip the whole group, label included

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
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
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border" />
    </Sidebar>
  );
}
```

Rules:
- **Skip empty groups entirely** — filter first, `return null` if nothing's left, don't render a bare label over nothing.
- Hiding a nav item is a UX nicety only — the destination route enforces the same gate itself (see the "Access-gated page wall" in §11), since a nav-only gate is trivially bypassed by typing the URL.
- The sidebar has its own token set (`--sidebar`, `--sidebar-accent`, etc.) distinct from the page background, so it can read as a slightly different surface in both themes without a one-off override.
- `Ctrl/Cmd+B` toggles collapse by default (built into the `Sidebar` primitive) — keep that binding, it's a common power-user habit shadcn users expect.

---

## 5. Navbar / header

The sticky header living next to the sidebar (see §3's shell snippet). Left side: sidebar toggle + breadcrumb (current page title, derived from the matched nav item or a small `EXTRA_PAGE_TITLES` map for pages not in the sidebar). Right side, always in this order: **notification bell → theme toggle → account dropdown**.

```tsx
<div className="ml-auto flex items-center gap-1">
  <NotificationBell />
  <ThemeToggle />
  <DropdownMenu>{/* see §9 */}</DropdownMenu>
</div>
```

**Notification bell** — icon button with an absolutely-positioned unread-count pill, dropdown list below it:
```tsx
<DropdownMenuTrigger asChild>
  <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
    <Bell className="h-4 w-4" />
    {count > 0 && (
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
        {count > 99 ? "99+" : count}
      </span>
    )}
  </Button>
</DropdownMenuTrigger>
<DropdownMenuContent align="end" className="w-80">
  <DropdownMenuLabel className="flex items-center justify-between gap-2">
    <span>Notifications</span>
    {count > 0 && <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs font-normal text-muted-foreground">Mark all read</Button>}
  </DropdownMenuLabel>
  <DropdownMenuSeparator />
  <div className="max-h-80 overflow-y-auto">
    {items.length === 0 ? (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
    ) : items.map((n) => (
      <DropdownMenuItem key={n.id} className="flex cursor-pointer flex-col items-start gap-0.5 whitespace-normal py-2">
        <div className="flex w-full items-start gap-1.5">
          {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          <p className={n.isRead ? "text-sm text-muted-foreground" : "text-sm font-medium"}>{n.title}</p>
        </div>
        {n.body && <p className="pl-3 text-xs text-muted-foreground">{n.body}</p>}
      </DropdownMenuItem>
    ))}
  </div>
</DropdownMenuContent>
```

**Theme toggle** — icon-only ghost button, swaps Sun/Moon, persists the choice server-side (or `localStorage` for a simpler app):
```tsx
<Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
  {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
</Button>
```

**Breadcrumb** (Radix-based primitive, not custom): current page only needs the trailing crumb to be a `<BreadcrumbPage>` (non-link, current), everything before it a `<BreadcrumbLink>` + `<BreadcrumbSeparator>`.

---

## 6. Buttons

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

**Usage patterns:**
- Primary action = `variant="default"` (no prop needed).
- Destructive action (delete) = `variant="destructive"`.
- Secondary/cancel = `variant="outline"`.
- Icon-only in a header/table row = `variant="ghost" size="icon"` with `aria-label`.
- A button that also navigates: `<Button asChild><Link to="/x">Label</Link></Button>` (uses Radix `Slot` via `asChild`).
- **Pending state**: swap the leading icon for a spinner, keep the label text, disable the button:
  ```tsx
  <Button disabled={mutation.isPending} onClick={handleSave}>
    {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
    Save changes
  </Button>
  ```

---

## 7. Textboxes — Input, Textarea, chip input

**Input** (`h-9`, transparent background so it inherits card/dialog bg):
```tsx
<input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" />
```

**Textarea** — identical treatment, `min-h-[60px]`.

**Labeled field pattern** (every form field in this app):
```tsx
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted-foreground">Employee email</label>
  <Input type="email" value={form.employeeEmail} onChange={(e) => setForm((f) => ({ ...f, employeeEmail: e.target.value }))} />
</div>
```

**Multi-value "chip" input** (e.g. a Cc list) — type/paste, Enter or comma commits a chip, Backspace on empty deletes the last one:
```tsx
export function EmailChipInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const addresses = value.split(",").map((a) => a.trim()).filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring">
      {addresses.map((address) => (
        <span key={address} className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-1.5 pr-1 text-xs text-primary">
          <Mail className="size-3" />
          <span>{address}</span>
          <button onClick={() => onChange(addresses.filter((a) => a !== address).join(", "))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        placeholder={addresses.length === 0 ? placeholder : "Add another…"}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); /* validate + commit */ }
        }}
        className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
```

**Select** (Radix, `SelectTrigger`/`SelectContent`/`SelectItem`) — `h-9`, chevron icon, checkmark on the selected item, animates in/out:
```tsx
<Select value={form.office} onValueChange={(v) => setForm((f) => ({ ...f, office: v }))}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {OFFICES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
  </SelectContent>
</Select>
```

**Switch** (toggle) — `h-5 w-9`, thumb slides via `data-[state=checked]:translate-x-4`:
```tsx
<Switch checked={account.isActive} disabled={isPending} onCheckedChange={handleToggle} />
```

---

## 8. Modals

Two distinct primitives, used for two distinct purposes — **do not mix them up**:

| | `Dialog` | `AlertDialog` |
|---|---|---|
| Use for | Forms, previews, anything with real content/inputs | A single yes/no destructive confirmation |
| Trigger | Externally controlled (`open`/`onOpenChange` from parent state) | Same, or `<AlertDialogTrigger>` |
| Escape/overlay click | Closes normally | Closes normally (unless mid-mutation — guard it) |
| Action button | Plain `<Button>` | `<AlertDialogAction>` (styled via `buttonVariants`) |

**Standard modal shape** (both primitives share this shape):
```tsx
<Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
  <DialogContent className="max-w-xl">
    <DialogHeader>
      <DialogTitle>Send this email now?</DialogTitle>
      <DialogDescription>This sends immediately. There's no undo once it's gone out.</DialogDescription>
    </DialogHeader>

    {/* body content */}

    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button disabled={busy} onClick={onConfirm}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send now
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Key rules baked into every modal in this app:
- **Guard closing while a mutation is in flight**: `onOpenChange={(next) => !busy && onOpenChange(next)}` — never let Escape/overlay-click discard an in-progress action.
- **Loading state inside the modal** (data not fetched yet): a centered spinner, not a blank dialog:
  ```tsx
  {!record ? (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  ) : ( /* real content */ )}
  ```
- **Destructive delete confirmation** — always `AlertDialog`, never a plain `Dialog`, never `window.confirm()`:
  ```tsx
  <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <AlertDialogTitle>Delete this record?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes {target?.name}. This can't be undone, though the deletion itself is logged.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => { e.preventDefault(); confirmDelete(); }}
          disabled={deleteMutation.isPending}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {deleteMutation.isPending ? "Removing..." : "Delete"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```
- **Multi-step / checklist-gated confirmation** for anything with a bigger blast radius (bulk send, bulk delete): render a checklist of plain-language "I understand..." checkboxes; disable the confirm button until every box is checked. Don't rely on a single "are you sure" click for irreversible bulk actions.
- **Edit-form modal** — seed local state from the record on open (`useEffect` keyed on `open`), track a `hasChanges` diff against the original so Save stays disabled until something actually changed:
  ```tsx
  useEffect(() => { if (open) setForm(toForm(record)); }, [open, record]);
  const hasChanges = (Object.keys(form) as (keyof FormState)[]).some((k) => form[k] !== toForm(record)[k]);
  ```

---

## 9. Dropdown menu (account menu, row action menus)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="h-9 gap-2 px-2">
      <Avatar className="size-7">...</Avatar>
      <span className="hidden text-sm sm:inline">{displayName}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel>
      <p className="text-sm font-medium">{displayName}</p>
      <p className="text-xs font-normal text-muted-foreground">{email}</p>
      <Badge variant="secondary" className="mt-1.5 gap-1 font-normal"><ShieldCheck className="h-3 w-3" />{roleLabel}</Badge>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={...}><User className="mr-2 h-4 w-4" /> Profile</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
A submenu (role/action picker nested inside the same dropdown) uses `DropdownMenuSub` / `DropdownMenuSubTrigger` / `DropdownMenuSubContent` — same visual language, just nested one level.

---

## 10. Toaster (sonner)

Mount **once**, at the app root, alongside the router outlet:
```tsx
// src/components/ui/sonner.tsx
import { Toaster as Sonner } from "sonner";

const Toaster = (props: React.ComponentProps<typeof Sonner>) => (
  <Sonner
    className="toaster group"
    toastOptions={{
      classNames: {
        toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-muted-foreground",
        actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
        cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
      },
    }}
    {...props}
  />
);

// root layout:
<QueryClientProvider client={queryClient}>
  <AppShell><Outlet /></AppShell>
  <Toaster />
</QueryClientProvider>
```

**Usage convention** — every mutation's `onSuccess`/`onError` (or a try/catch around a mutateAsync) ends in exactly one toast:
```tsx
import { toast } from "sonner";

updateAccount.mutate({ id, patch }, {
  onSuccess: () => toast.success("Role updated"),
  onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update role"),
});
```
- `toast.success(...)` for a completed action, phrased as what happened ("Role updated", not "Success!").
- `toast.error(...)` always tries to surface the real backend message first (`err instanceof Error ? err.message : "fallback"`), never a generic "Something went wrong" if a real message is available.
- Never toast on page-load/read errors — only on user-triggered actions (writes).

---

## 11. Alerts (inline banners, not modals)

Base primitive:
```tsx
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  { variants: { variant: {
    default: "bg-background text-foreground",
    destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
  } }, defaultVariants: { variant: "default" } },
);

<Alert>
  <Cake className="h-4 w-4" />
  <AlertTitle>3 birthdays this week</AlertTitle>
  <AlertDescription>Jane Doe (Mar 12), ... . Turn this off on the Settings page.</AlertDescription>
</Alert>
```

**Ad-hoc colored status banners** (more common in this app than the `Alert` primitive itself) follow one recurring shape — a flex row, icon + text, tinted border/background, explicit dark variant:
```tsx
// warning / needs-attention (amber)
<div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
  <span>On hold — this won't proceed until it's marked ready again.</span>
</div>

// success (emerald)
<div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
  <Check className="mt-0.5 size-4 shrink-0" />
  <div><p className="font-medium">Sent successfully</p><p className="mt-0.5">To jane@company.com</p></div>
</div>

// error / failed (destructive token, not raw red — this one IS themed)
<div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
  <div><p className="font-medium">Send failed</p><p className="mt-0.5 text-destructive/90">{errorDetail}</p></div>
</div>
```
Palette convention: **amber** = warning/needs-attention/in-progress, **emerald** = success/sent/complete, **destructive token** = error/failed/delete, **primary** = neutral highlight (selection banners, e.g. "3 records selected").

**Status pill/badge** (small, inline, in a table cell or page header):
```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  { variants: { variant: {
    default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
    outline: "text-foreground",
  } }, defaultVariants: { variant: "default" } },
);

// A page-level "this feature is still being finished" flag next to a title:
<Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
  In Progress
</Badge>
```

---

## 12. Cards, Tables, Avatars

**Card** — the universal content container (metric tiles, settings sections, table wrappers):
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> Section title</CardTitle>
    <CardDescription>One sentence of context.</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">...</CardContent>
</Card>
// primitive: rounded-xl border bg-card text-card-foreground shadow
```

**Table** — wrap in `<Card><CardContent className="overflow-x-auto p-0">` so it scrolls horizontally without breaking the card's rounded corners:
```tsx
<Table>
  <TableHeader><TableRow><TableHead>Name</TableHead>...</TableRow></TableHeader>
  <TableBody>
    {rows.map((r) => <TableRow key={r.id}>...</TableRow>)}
    {rows.length === 0 && <TableRow><TableCell colSpan={N} className="h-24 text-center text-muted-foreground">No records match these filters.</TableCell></TableRow>}
  </TableBody>
</Table>
// row hover: hover:bg-muted/50, selected row: bg-primary/5 (a custom className, not the primitive's own data-state)
```

**Avatar with initials fallback** (person rows, header account menu):
```tsx
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

<Avatar className="size-8">
  {photoUrl && <AvatarImage src={photoUrl} alt={displayName} />}
  <AvatarFallback className="text-xs">{initials(displayName)}</AvatarFallback>
</Avatar>
```

**Metric card** (the one dashboard/stat-tile shape used everywhere — total counts, KPIs):
```tsx
export function MetricCard({ title, value, hint, icon: Icon }: {
  title: string; value: number | string; hint: string; icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
```
Always laid out in a responsive grid, never a single column: `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` (or `sm:grid-cols-2 xl:grid-cols-4` for four tiles). Icon top-right, small and muted; the number is the visual anchor (`text-3xl font-semibold`), everything else is `text-xs`/`text-sm text-muted-foreground`.

---

## 13. Dashboard page pattern

Structure, top to bottom:
1. `PageHeader` (title + one-line description + an action button, e.g. "Open directory").
2. An optional dismissible-feeling **info banner** above the fold (e.g. "3 birthdays this week") — the ad-hoc `Alert` shape from §11, gated by a user preference.
3. A `MetricCard` grid — the big top-line numbers for whatever this dashboard is about.
4. **Per-module "snapshot" cards** — a compact 3-stat summary + a single "Open X" button, one per module the signed-in role actually has access to:
   ```tsx
   <div className="grid gap-4 lg:grid-cols-2">
     {canViewModuleA && (
       <Card className={canViewModuleB ? undefined : "lg:col-span-2"}>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Module A Snapshot
           </CardTitle>
           <CardDescription>One line describing what's tracked here</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid grid-cols-3 gap-3 text-center">
             <div><p className="text-2xl font-semibold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
             <div><p className="text-2xl font-semibold">{stats.inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
             <div><p className="text-2xl font-semibold">{stats.done}</p><p className="text-xs text-muted-foreground">Complete</p></div>
           </div>
           <Button asChild size="sm" variant="outline" className="w-full">
             <Link to="/module-a">Open module A <ArrowRight className="ml-2 h-4 w-4" /></Link>
           </Button>
         </CardContent>
       </Card>
     )}
   </div>
   ```
   Note the `className={otherCardVisible ? undefined : "lg:col-span-2"}` trick — when only one of a 2-up pair of cards is visible for this role, it expands to fill the row instead of leaving a gap.
5. A richer analytics row for power roles only — e.g. a trend chart + a breakdown card, `grid gap-4 lg:grid-cols-3` (chart spans `lg:col-span-2`, breakdown card takes the remaining column).
6. A "recent activity" pair — two list cards side by side (`grid gap-4 lg:grid-cols-2`), same expand-to-fill-when-alone rule as step 4.

**Role-scoping rule**: a full "everything, company-wide" dashboard view is for admin-tier roles only; every other role gets *only* the snapshot cards for modules their own permissions actually cover — never the full cross-module analytics rollup. Compute this once at the top of the component (`const isFullAccess = isFullAccessRole(role)`) and gate whole sections on it, not individual numbers.

---

## 14. Analytics & Charts

Charts are `recharts` primitives wrapped in a themeable `ChartContainer` so series colors come from CSS variables (`--chart-1`…`--chart-5`) and automatically match light/dark mode — never hardcode a hex color into a `<Bar fill="...">`.

**Chart config + container + tooltip** (the recurring shape for every chart in this app):
```tsx
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const officeConfig = {
  active: { label: "Active", color: "var(--chart-1)" },
  inactive: { label: "Inactive", color: "var(--chart-3)" },
} satisfies ChartConfig;

function OfficeDistributionChart({ data }: { data: { office: string; active: number; inactive: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Office Distribution</CardTitle>
        <CardDescription>Headcount split across delivery hubs</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={officeConfig} className="h-[280px] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="office" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="active" fill="var(--color-active)" radius={4} />
            <Bar dataKey="inactive" fill="var(--color-inactive)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```
`ChartContainer` injects a scoped `<style>` block mapping each config key to a `--color-{key}` CSS variable (resolved per light/dark theme from the config's `color`/`theme` field) — that's what `fill="var(--color-active)"` is reading from. It also strips recharts' default outlines/strokes and re-themes the grid/tooltip cursor to the app's `--border`/`--muted` tokens via one big `[&_.recharts-*]` selector block, so a chart dropped into a themed card never looks like an unstyled recharts default.

**Avoid hydration-mismatch flicker on first paint** — recharts needs real DOM measurements, which don't exist during SSR; gate first render behind a `mounted` flag and show a `Skeleton` until then:
```tsx
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
// in the component: {!mounted ? <Skeleton className="h-[260px] w-full" /> : <ChartContainer ...>...}
```

**Pie chart** — same `ChartContainer`/`ChartConfig` wrapper, `<Cell fill={...}>` per slice instead of a single `fill` on the series:
```tsx
<ChartContainer config={config} className="h-[280px] w-full max-w-[320px]">
  <PieChart>
    <ChartTooltip content={<ChartTooltipContent />} />
    <Pie data={rows} dataKey="count" nameKey="office" innerRadius={50} outerRadius={90}>
      {rows.map((row) => <Cell key={row.office} fill={`var(--color-${row.office})`} />)}
    </Pie>
  </PieChart>
</ChartContainer>
```

**Analytics page layout** — group related charts under `Tabs`, each tab a responsive 2-up grid of chart cards plus one full-width trend chart:
```tsx
<Tabs defaultValue="workforce">
  <TabsList>
    <TabsTrigger value="workforce">Workforce</TabsTrigger>
    <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
    <TabsTrigger value="attendance">Attendance</TabsTrigger>
  </TabsList>

  <TabsContent value="workforce" className="space-y-4 pt-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <MonthlyHiringTrendChart /> <HeadcountGrowthChart />
      <DepartmentDistributionChart /> <TenureDistributionChart />
    </div>
    <HeadcountTrendChart /> {/* full-width, below the 2-up grid */}
  </TabsContent>

  <TabsContent value="onboarding" className="pt-4">
    <div className="grid gap-4 lg:grid-cols-2"><OnboardingCompletionChart /></div>
  </TabsContent>
</Tabs>
```
Analytics (the cross-module rollup) is admin-tier-only, same access-gated page wall as any other restricted page (§4's nav-gating, §16's page wall) — everyone else's cross-module view is limited to the dashboard's per-module snapshot cards (§13), never the full analytics breakdown.

---

## 15. Login page

Full-bleed (no sidebar/header chrome — see §3's standalone-route exclusion). Split-panel layout: sign-in form left, brand/feature panel right (hidden on mobile).

```tsx
function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/30 p-6">
      {/* soft radial glow behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(600px circle at 50% 35%, var(--primary), transparent 60%)", opacity: 0.06 }} />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl border bg-card shadow-2xl sm:grid-cols-2">
        {/* Sign-in panel */}
        <div className="flex flex-col justify-center px-8 py-12 sm:px-10">
          <div className="mx-auto w-full max-w-xs">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
            <Button className="mt-6 w-full shadow-sm transition-shadow hover:shadow-md" size="lg" onClick={handleSignIn}>
              Continue with SSO
            </Button>
            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              Access is limited to authorized staff. Contact your admin if you can't sign in.
            </p>
          </div>
        </div>

        {/* Decorative panel — deliberately fixed dark colors, NOT theme tokens */}
        <div className="relative hidden flex-col justify-center gap-8 bg-[#0f2a3d] px-10 py-12 sm:flex">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <img src={logo} alt="Company" className="relative h-16 w-auto object-contain" />
          <div className="relative">
            <h2 className="text-xl font-semibold text-white">Company Name</h2>
            <p className="mt-2 max-w-[240px] text-sm text-white/60">One-line pitch.</p>
          </div>
          <ul className="relative flex w-full flex-col gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#8bc47f]/15">
                  <Icon className="size-4 text-[#8bc47f]" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Auth-guard pattern** (client-side redirect, since SSR has no cookie context yet): a shell component checks `useCurrentAccount()`, renders nothing (`return null`) while loading, and `navigate({ to: "/login" })` once it resolves to signed-out. Never flash the app before the check resolves.

**Post-login error surfacing**: the backend redirects back to `/login?error=<code>`; the login page reads that query param once on mount and fires a matching `toast.error(...)` (`inactive`, `invite_only`, generic `sso` failure, etc.) — one `if/else if` chain, not a generic message.

---

## 16. User Management page (admin table + role picker + settings cards)

Standard shape for any "list of accounts/entities with inline edit controls" admin page:

1. **Metric row** — `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` of `MetricCard`s (totals, counts by status).
2. **Main table card** — one row per entity, inline controls in cells (not a separate edit page):
   ```tsx
   <TableCell>
     <Select value={account.role} disabled={isSelf || updateAccount.isPending} onValueChange={(v) => handleRoleChange(account.id, v)}>
       <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
       <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
     </Select>
   </TableCell>
   <TableCell>
     <div className="flex items-center gap-2">
       <Switch checked={account.isActive} disabled={isSelf} onCheckedChange={(v) => handleActiveToggle(account.id, v)} />
       <Badge variant={account.isActive ? "default" : "secondary"}>{account.isActive ? "Active" : "Inactive"}</Badge>
     </div>
   </TableCell>
   ```
   Rule: **disable self-edit** on anything that could lock the acting admin out (their own role, their own active toggle) — `disabled={isSelf || mutation.isPending}` — and enforce the same guard server-side, not just in the UI.
3. **"Add User" dialog** — a small `Dialog` with just an email + role Select, disabled Add button until the email passes a regex.
4. **Empty/loading/error states** are always three explicit branches in the table body, never a blank table:
   ```tsx
   {query.isLoading ? <TableRow><TableCell colSpan={N} className="h-24 text-center text-muted-foreground">Loading...</TableCell></TableRow>
    : query.isError ? <TableRow><TableCell colSpan={N} className="h-24 text-center text-muted-foreground">Couldn't load. Try refreshing.</TableCell></TableRow>
    : rows.length === 0 ? <TableRow><TableCell colSpan={N} className="h-24 text-center text-muted-foreground">Nothing here yet.</TableCell></TableRow>
    : rows.map(...)}
   ```
5. **Settings toggle card** (a single on/off feature flag, admin-only) — the recurring shape for "one Switch + explanation":
   ```tsx
   <Card>
     <CardHeader>
       <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /> Sign-in Access</CardTitle>
       <CardDescription>Control who can create a brand-new account.</CardDescription>
     </CardHeader>
     <CardContent>
       <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
         <div>
           <p className="text-sm font-medium">Require an invite to sign in</p>
           <p className="text-sm text-muted-foreground">When on, only pre-assigned emails can create a new account.</p>
         </div>
         <Switch checked={settings?.inviteOnly ?? false} disabled={isLoading || updateMutation.isPending} onCheckedChange={handleToggle} />
       </div>
     </CardContent>
   </Card>
   ```
6. **Permission matrix / capability grid** (roles as columns, permissions as rows, one Switch per cell) — draft state in local `useState` seeded from the fetched matrix via `useEffect`, a "Save changes" button disabled until the draft actually differs from the server value, one bulk PUT on save (not one request per toggle).

---

## 17. Access-gated page wall

The exact same 3-state pattern every role/permission-gated page in this app uses — nav-hiding (§4) is a nicety, this is the real enforcement:
```tsx
if (accountLoading) return (<div className="space-y-6"><PageHeader .../><p className="text-sm text-muted-foreground">Checking access…</p></div>);
if (!canView) return (
  <div className="space-y-6">
    <PageHeader .../>
    <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" />
      <div><p className="font-medium">No access</p><p className="text-sm text-muted-foreground">Your account doesn't have access to this. Ask an admin if you need it.</p></div>
    </CardContent></Card>
  </div>
);
// ...else render the real page
```

---

## 18. Loading / empty / disabled conventions (cross-cutting)

- **Spinner**: always `<Loader2 className="size-4 animate-spin" />` (or `size-5`), never a custom spinner component.
- **Page-level loading**: a single centered `<Loader2 className="size-5 animate-spin" />` inside a `flex items-center justify-center` box with fixed height (`py-8`/`py-10`), not a layout shift.
- **Empty state**: an icon + one-line message, centered, muted-foreground — never just blank space.
- **Disabled-while-pending**: every mutating button is `disabled={mutation.isPending}` and swaps its icon for the spinner — the label text usually stays the same or becomes a present-continuous verb ("Saving..." instead of "Save").
- **Self-action guards**: anything that could let a user break their own access (deactivate self, demote self, restrict self) is disabled in the UI *and* rejected server-side with a clear 400.

---

## 19. Animations

No animation *library* drives any motion in this app (`motion`, a Framer Motion successor, is installed but genuinely unused — see §1) — everything is **CSS utility classes reacting to Radix's `data-state` attributes**, via `tw-animate-css`'s `animate-in`/`animate-out` utilities plus a handful of plain Tailwind transitions. Reach for a JS animation library only once something needs physics (drag-to-dismiss), shared-layout transitions, or scroll-linked effects — none of which anything here currently needs.

**Overlay open/close** (Dialog, AlertDialog, Sheet) — the same three-part shape every time: fade the overlay, fade+zoom the content in, fade+zoom it back out on close. Radix flips `data-state` between `open`/`closed`, Tailwind's `data-[state=...]` variant selects the animation:
```tsx
// overlay
"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

// content
"duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
```

**Popover-shaped content** (DropdownMenu, Select, Popover, HoverCard, Menubar, ContextMenu) — same fade+zoom as above, *plus* a directional slide keyed off which side of the trigger it actually opened on (`data-side`), so a menu that opens above the trigger slides down into place and one that opens below slides up:
```tsx
"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)"
```
The `origin-(--radix-*-content-transform-origin)` bit matters: it points the zoom's transform-origin at Radix's own computed anchor point, so content scales in from the trigger rather than from its own center.

**Off-canvas panels** (Sheet, mobile sidebar rail) — slide the whole panel in/out from whichever edge it's docked to:
```tsx
// right-docked sheet
"data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
```

**Sidebar collapse** — not a Radix `data-state`, just a plain width/position transition keyed off the `SidebarProvider`'s own `open`/`collapsed` React state:
```tsx
"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear"
```

**Micro-interactions** (small, don't need the animate-in/out machinery — plain `transition-*` + a hover/active transform):
```tsx
// checkbox check mark popping in
"data-[state=checked]:animate-in data-[state=checked]:zoom-in-50 data-[state=checked]:duration-200"

// checkbox box itself, on hover/press
"transition-all duration-150 ease-out hover:scale-110 active:scale-95 data-[state=checked]:scale-105"

// chevron rotating open (Accordion)
"transition-transform duration-200 [&[data-state=open]>svg]:rotate-180"

// switch thumb sliding
"transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
```

**Loading states** — two fixed patterns, never a custom spinner/skeleton animation:
```tsx
<Loader2 className="size-4 animate-spin" />        {/* any pending action */}
<Skeleton className="h-24 w-full" />                {/* bg-primary/10 animate-pulse rounded-md, any not-yet-loaded content */}
```

**Rules of thumb:**
- Every interactive Radix primitive already ships these classes in shadcn's copy of `ui/*.tsx` — you don't hand-write them per usage, only when authoring a *new* primitive from scratch.
- Keep durations short and consistent: `duration-150`/`200` for micro-interactions and overlays, `duration-300`/`500` only for the heavier Sheet slide.
- Never animate `top`/`left`/`width`/`height` on anything performance-sensitive — the one exception here (`transition-[width]` on the sidebar rail) is a deliberate, isolated case, not the default approach.
- If a future need genuinely can't be expressed as a `data-state` transition (drag-to-reorder, a shared-element transition between routes), that's the signal to actually start using the already-installed `motion` package — not to fight it in CSS.

---

## 20. Quick-start checklist for a new project

1. Copy `src/styles.css`'s token block (light + dark + `@theme inline`) verbatim, swap `--primary`/`--sidebar-primary` for the new brand color (keep everything else — the ratios between background/card/border/muted are what make it look coherent).
2. Copy `src/components/ui/*` wholesale (they're framework primitives, not app-specific) — includes `sidebar.tsx` and `chart.tsx`.
3. Mount one `<Toaster />` at the root, alongside your router/query provider.
4. Build the shell once (`AppShell` = sidebar + header + main), everything else renders inside it.
5. Use `Dialog` for anything with content, `AlertDialog` only for single-action destructive confirmations.
6. Every list/table page gets: metric row → filter bar → table (loading/error/empty branches) → pagination footer.
7. Every mutation: `useMutation` → `onSuccess: () => toast.success("plain past-tense sentence")`, `onError: (e) => toast.error(e instanceof Error ? e.message : "fallback")`.
8. Status colors: amber = warning/in-progress, emerald = success, `destructive` token = error, `--chart-1..5` for data viz — never introduce a new hue without a reason.
9. Dashboard and nav are role/permission-scoped from day one, not bolted on later: compute `isFullAccess`/`canView*` once per page and gate sections on it.
10. Drop in your own light/dark/on-dark logo exports (§3) — everything else (sidebar header, login panel) is theme-driven off them, no code changes needed.
11. Don't install an animation library up front — `tw-animate-css` + Radix `data-state` variants (§19) cover every real case in this reference; add one only when you hit something CSS genuinely can't do.
