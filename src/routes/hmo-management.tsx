// Layout route for everything under /hmo-management — the main tabs page
// (hmo-management.index.tsx) and a single member's profile
// (hmo-management.$memberId.tsx) are its two child routes, same split as
// directory.tsx/directory.$employeeId.tsx. This file only exists to give
// them a shared parent to render into via <Outlet />; each child route
// gates its own access.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/hmo-management")({
  component: () => <Outlet />,
});
