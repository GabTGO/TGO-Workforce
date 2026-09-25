// The standard way an employee's name renders wherever one shows up across
// the app (Directory, Dashboard, New Hires, Anniversaries, Birthdays,
// Recognition & Awards) — a link to their full profile
// (/directory/$employeeId) wrapped in the same hover preview
// (@/components/employee-hover-card) everywhere, so the experience is
// identical no matter which page you're looking at their name from.
import { Link } from "@tanstack/react-router";

import { EmployeeHoverCard } from "@/components/employee-hover-card";
import type { Employee } from "@/data/employees";
import { cn } from "@/lib/utils";

export function EmployeeNameLink({
  employee,
  className,
}: {
  employee: Employee;
  className?: string;
}) {
  return (
    <EmployeeHoverCard employee={employee}>
      <Link
        to="/directory/$employeeId"
        params={{ employeeId: employee.id }}
        className={cn(
          "hover:underline hover:decoration-primary/60 hover:underline-offset-2",
          className,
        )}
      >
        {employee.name}
      </Link>
    </EmployeeHoverCard>
  );
}
