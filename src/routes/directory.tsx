// Layout route for everything under /directory — the Employee Directory
// table (directory.index.tsx) and a single employee's profile
// (directory.$employeeId.tsx) are its two child routes, same split as
// user-management.tsx/user-management.$accountId.tsx. This file only exists
// to give them a shared parent to render into via <Outlet />; each child
// route gates its own access.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/directory")({
  component: () => <Outlet />,
});
