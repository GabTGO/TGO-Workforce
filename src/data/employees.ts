export type EmployeeStatus = "Active" | "Resigned" | "Terminated";

export interface Employee {
  id: string;
  name: string;
  office: string;
  department: string;
  position: string;
  jobOfferDate?: string; // ISO
  startDate: string; // ISO
  status: EmployeeStatus;
  exitDate?: string;
  birthday: string; // ISO (year may be birth year); "" when unknown
  sourceType?: string;
  createdAt?: string; // ISO timestamp — when the record was added to TGO Workforce
  updatedAt?: string; // ISO timestamp — last edit to the record
}

export const OFFICES = ["PH Eastwood", "CO Medellin"] as const;

export const DEPARTMENTS = [
  "Dispatch",
  "Business Admin",
  "Recruitment",
  "Management",
  "Sales",
  "FHP",
  "Projects",
  "Payroll",
] as const;

export const POSITIONS = [
  "L1 - Dispatcher",
  "L2 - Dispatcher",
  "Spanish Dispatcher",
  "Dispatch Lead",
  "Dispatch Supervisor",
  "Business Associate",
  "Recruitment Associate",
  "Talent Acquisition Lead",
  "Sales Representative",
  "US Payroll Specialists",
  "Payroll Associate",
  "FHP - VA",
  "FHP - Bid Coordinator",
  "Chief of Staff",
  "HR Transport",
  "Onboarding & Offboarding Specialist",
  "AI & Automations Lead",
  "Head of BA",
  "Head of Dispatch",
  "Head of HR",
  "Head of Projects & Payroll",
] as const;

export const STATUSES: EmployeeStatus[] = ["Active", "Resigned", "Terminated"];

/** Parses a plain "YYYY-MM-DD" calendar date (birthday, start date, exit
 * date, job offer date) as LOCAL midnight instead of UTC midnight.
 *
 * `new Date("YYYY-MM-DD")` is specced to parse date-only strings as UTC, but
 * every local-timezone-aware read of that Date — `.toLocaleDateString()`,
 * `.getMonth()`/`.getDate()`/`.getFullYear()`, or comparing it against a
 * real `new Date()` "now" — then silently shifts it by a day for anyone
 * viewing from a timezone behind UTC. That's exactly the bug reported
 * 2026-09-03: a birthday entered and stored as 2003-06-16 (and shown
 * correctly as 06/16/2003 in the `<input type="date">`, which doesn't do
 * this conversion) was rendering as "Jun 15, 2003" everywhere `formatDate()`
 * touched it. Appending a bare time-of-day with no "Z"/offset makes the
 * `Date` constructor parse it as local time instead, which is what a
 * calendar date — something with no timezone of its own — actually needs.
 * A full backend timestamp (createdAt/updatedAt) isn't a plain date-only
 * string, so it falls through to a normal parse and keeps converting from
 * UTC to the viewer's local time as it should. */
function parseCalendarDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
}

/** Raw day count between start and (exit or today) — the source of truth for
 * every "how long has this person been here" display and export column. */
export function tenureDays(startDate: string, exitDate?: string) {
  const start = parseCalendarDate(startDate);
  const end = exitDate ? parseCalendarDate(exitDate) : new Date();
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
}

export function tenure(startDate: string, exitDate?: string) {
  const start = parseCalendarDate(startDate);
  const end = exitDate ? parseCalendarDate(exitDate) : new Date();
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(months, 0);
  const y = Math.floor(months / 12);
  const m = months % 12;
  // Under a month, "0y 0m" reads as broken rather than "brand new" — fall
  // back to a day count for anyone hired inside the current month.
  if (y === 0 && m === 0) {
    const days = tenureDays(startDate, exitDate);
    return days <= 1 ? "1 day" : `${days} days`;
  }
  return `${y}y ${m}m`;
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return parseCalendarDate(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const REFERENCE_NOW = new Date();

// Everything below is a pure function of the employee list the caller passes
// in — none of it reads a module-level array anymore. The list itself comes
// from the API via useEmployees() (@/data/employee-store), so every page
// that used to call e.g. metrics() with no arguments now calls
// metrics(employees) with whatever that hook returned.

export function metrics(employees: Employee[]) {
  const active = employees.filter((e) => e.status === "Active");
  const inactive = employees.filter((e) => e.status !== "Active");
  const oneYearAgo = new Date(REFERENCE_NOW);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const newHires = employees.filter(
    (e) => parseCalendarDate(e.startDate) >= oneYearAgo,
  );
  const exits = employees.filter(
    (e) => e.exitDate && parseCalendarDate(e.exitDate) >= oneYearAgo,
  );
  return {
    active: active.length,
    inactive: inactive.length,
    newHires: newHires.length,
    exits: exits.length,
    eastwood: active.filter((e) => e.office === "PH Eastwood").length,
    medellin: active.filter((e) => e.office === "CO Medellin").length,
    newHireList: newHires.sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    ),
  };
}

export function officeDistribution(employees: Employee[]) {
  return OFFICES.map((office) => ({
    office,
    active: employees.filter(
      (e) => e.office === office && e.status === "Active",
    ).length,
    inactive: employees.filter(
      (e) => e.office === office && e.status !== "Active",
    ).length,
  }));
}

export function statusDistribution(employees: Employee[]) {
  return STATUSES.map((status) => ({
    status,
    count: employees.filter((e) => e.status === status).length,
  }));
}

export function headcountTrend(employees: Employee[]) {
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const base = employees.filter((e) => e.status === "Active").length - 5;
  return months.map((month, i) => ({ month, headcount: base + i + (i % 2) }));
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function upcomingBirthdays(employees: Employee[]) {
  return employees
    .filter((e) => e.status === "Active" && e.birthday)
    .flatMap((e) => {
      const d = parseCalendarDate(e.birthday);
      // Skip rows with an unparsable or missing birthday (e.g. blank cells from
      // an Excel import) instead of producing a NaN month that crashes the page.
      if (Number.isNaN(d.getTime())) return [];
      return [
        {
          ...e,
          monthIndex: d.getMonth(),
          day: d.getDate(),
          monthName: MONTH_NAMES[d.getMonth()]!,
        },
      ];
    })
    .sort((a, b) => a.monthIndex - b.monthIndex || a.day - b.day);
}

export function anniversaries(employees: Employee[]) {
  return employees
    .filter((e) => e.status === "Active" && e.startDate)
    .flatMap((e) => {
      const d = parseCalendarDate(e.startDate);
      if (Number.isNaN(d.getTime())) return [];
      const years = REFERENCE_NOW.getFullYear() - d.getFullYear();
      return [
        {
          ...e,
          monthIndex: d.getMonth(),
          day: d.getDate(),
          monthName: MONTH_NAMES[d.getMonth()]!,
          years: Math.max(years, 0),
        },
      ];
    })
    .sort((a, b) => a.monthIndex - b.monthIndex || a.day - b.day);
}

export function departmentDistribution(employees: Employee[]) {
  return DEPARTMENTS.map((department) => ({
    department,
    active: employees.filter(
      (e) => e.department === department && e.status === "Active",
    ).length,
    inactive: employees.filter(
      (e) => e.department === department && e.status !== "Active",
    ).length,
  }));
}

function monthsBetween(startDate: string, end: Date) {
  const start = parseCalendarDate(startDate);
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

export function tenureDistribution(employees: Employee[]) {
  const buckets = [
    { band: "0-1 yr", min: 0, max: 12 },
    { band: "1-3 yrs", min: 12, max: 36 },
    { band: "3-5 yrs", min: 36, max: 60 },
    { band: "5-8 yrs", min: 60, max: 96 },
    { band: "8+ yrs", min: 96, max: Infinity },
  ];
  return buckets.map((b) => ({
    band: b.band,
    employees: employees.filter((e) => {
      if (e.status !== "Active") return false;
      const m = monthsBetween(e.startDate, REFERENCE_NOW);
      return m >= b.min && m < b.max;
    }).length,
  }));
}

/** Last 12 months of hires vs exits. */
export function monthlyHiringTrend(employees: Employee[]) {
  const out: { month: string; hires: number; exits: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(
      REFERENCE_NOW.getFullYear(),
      REFERENCE_NOW.getMonth() - i,
      1,
    );
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      month: `${MONTH_NAMES[d.getMonth()]!.slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
      hires: employees.filter((e) => e.startDate.startsWith(key)).length,
      exits: employees.filter((e) => e.exitDate?.startsWith(key)).length,
    });
  }
  return out;
}

/** Cumulative active headcount at the end of each of the last 12 months. */
export function headcountGrowth(employees: Employee[]) {
  const out: { month: string; headcount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = new Date(
      REFERENCE_NOW.getFullYear(),
      REFERENCE_NOW.getMonth() - i + 1,
      0,
    );
    const headcount = employees.filter((e) => {
      if (parseCalendarDate(e.startDate) > end) return false;
      if (e.exitDate && parseCalendarDate(e.exitDate) <= end) return false;
      return true;
    }).length;
    out.push({
      month: `${MONTH_NAMES[end.getMonth()]!.slice(0, 3)} ${String(end.getFullYear()).slice(2)}`,
      headcount,
    });
  }
  return out;
}
