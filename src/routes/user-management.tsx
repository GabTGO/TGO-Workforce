// Layout route for everything under /user-management — the Accounts list
// (user-management.index.tsx) and a single account's profile
// (user-management.$accountId.tsx) are its two child routes. This file only
// exists to give them a shared parent to render into via <Outlet />; it has
// no content or access-gating of its own (each child route gates itself).
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/user-management")({
  component: () => <Outlet />,
});
