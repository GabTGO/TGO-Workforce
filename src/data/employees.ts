export type EmployeeStatus = "Active" | "Resigned" | "Terminated";

export interface Employee {
  id: string;
  name: string;
  office: string;
  department: string;
  position: string;
  startDate: string; // ISO
  status: EmployeeStatus;
  exitDate?: string;
  birthday: string; // ISO (year may be birth year)
}

export const OFFICES = ["PH Eastwood", "CO Medellin"] as const;

export const DEPARTMENTS = [
  "Automation",
  "AI Engineering",
  "Operations",
  "People Ops",
  "Finance",
  "Customer Success",
] as const;

export const STATUSES: EmployeeStatus[] = ["Active", "Resigned", "Terminated"];

export const employees: Employee[] = [
  { id: "TGO-1001", name: "Maria Santos", office: "PH Eastwood", department: "Automation", position: "RPA Developer", startDate: "2021-03-15", status: "Active", birthday: "1993-08-29" },
  { id: "TGO-1002", name: "Juan Dela Cruz", office: "PH Eastwood", department: "Operations", position: "Operations Lead", startDate: "2019-07-01", status: "Active", birthday: "1988-09-02" },
  { id: "TGO-1003", name: "Camila Restrepo", office: "CO Medellin", department: "AI Engineering", position: "ML Engineer", startDate: "2022-01-10", status: "Active", birthday: "1995-01-19" },
  { id: "TGO-1004", name: "Andres Gomez", office: "CO Medellin", department: "Automation", position: "Automation Analyst", startDate: "2023-05-22", status: "Active", birthday: "1997-05-11" },
  { id: "TGO-1005", name: "Grace Lim", office: "PH Eastwood", department: "People Ops", position: "HR Generalist", startDate: "2020-11-09", status: "Resigned", exitDate: "2026-02-28", birthday: "1991-11-30" },
  { id: "TGO-1006", name: "Daniel Reyes", office: "PH Eastwood", department: "AI Engineering", position: "Data Scientist", startDate: "2024-02-05", status: "Active", birthday: "1994-03-08" },
  { id: "TGO-1007", name: "Valentina Ortiz", office: "CO Medellin", department: "Customer Success", position: "CS Specialist", startDate: "2023-09-18", status: "Active", birthday: "1998-08-27" },
  { id: "TGO-1010", name: "Paolo Bautista", office: "PH Eastwood", department: "Automation", position: "Senior RPA Developer", startDate: "2017-10-23", status: "Active", birthday: "1989-12-01" },
  { id: "TGO-1011", name: "Ana Lucia Vargas", office: "CO Medellin", department: "Operations", position: "Workforce Coordinator", startDate: "2025-10-03", status: "Active", birthday: "1996-02-22" },
  { id: "TGO-1012", name: "Ryan Mercado", office: "PH Eastwood", department: "Customer Success", position: "Account Manager", startDate: "2021-01-11", status: "Terminated", exitDate: "2025-12-15", birthday: "1990-07-19" },
  { id: "TGO-1013", name: "Isabella Cardona", office: "CO Medellin", department: "AI Engineering", position: "Prompt Engineer", startDate: "2026-01-06", status: "Active", birthday: "1999-09-09" },
  { id: "TGO-1016", name: "Angela Torres", office: "PH Eastwood", department: "Finance", position: "Payroll Officer", startDate: "2020-02-17", status: "Active", birthday: "1990-10-04" },
  { id: "TGO-1017", name: "Miguel Ramos", office: "PH Eastwood", department: "Operations", position: "Shift Supervisor", startDate: "2022-11-14", status: "Active", birthday: "1992-12-21" },
  { id: "TGO-1018", name: "Laura Betancur", office: "CO Medellin", department: "People Ops", position: "People Ops Analyst", startDate: "2026-04-21", status: "Active", birthday: "1997-09-12" },
  { id: "TGO-1020", name: "Bea Villanueva", office: "PH Eastwood", department: "AI Engineering", position: "AI Ops Engineer", startDate: "2026-07-14", status: "Active", birthday: "1996-08-25" },
  { id: "TGO-1021", name: "Diego Salazar", office: "CO Medellin", department: "Finance", position: "Accountant", startDate: "2021-06-07", status: "Active", birthday: "1991-03-15" },
  { id: "TGO-1022", name: "Kristine Yu", office: "PH Eastwood", department: "Customer Success", position: "CS Team Lead", startDate: "2018-08-20", status: "Active", birthday: "1989-09-23" },
  { id: "TGO-1023", name: "Tomas Arango", office: "CO Medellin", department: "Operations", position: "Process Analyst", startDate: "2023-12-04", status: "Terminated", exitDate: "2026-06-11", birthday: "1994-01-30" },
];

export function tenure(startDate: string, exitDate?: string) {
  const start = new Date(startDate);
  const end = exitDate ? new Date(exitDate) : new Date();
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(months, 0);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y}y ${m}m`;
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const REFERENCE_NOW = new Date();

export function metrics() {
  const active = employees.filter((e) => e.status === "Active");
  const inactive = employees.filter((e) => e.status !== "Active");
  const oneYearAgo = new Date(REFERENCE_NOW);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const newHires = employees.filter((e) => new Date(e.startDate) >= oneYearAgo);
  const exits = employees.filter((e) => e.exitDate && new Date(e.exitDate) >= oneYearAgo);
  return {
    active: active.length,
    inactive: inactive.length,
    newHires: newHires.length,
    exits: exits.length,
    eastwood: active.filter((e) => e.office === "PH Eastwood").length,
    medellin: active.filter((e) => e.office === "CO Medellin").length,
    newHireList: newHires.sort((a, b) => b.startDate.localeCompare(a.startDate)),
  };
}

export function officeDistribution() {
  return OFFICES.map((office) => ({
    office,
    active: employees.filter((e) => e.office === office && e.status === "Active").length,
    inactive: employees.filter((e) => e.office === office && e.status !== "Active").length,
  }));
}

export function statusDistribution() {
  return STATUSES.map((status) => ({
    status,
    count: employees.filter((e) => e.status === status).length,
  }));
}

export function headcountTrend() {
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const base = employees.filter((e) => e.status === "Active").length - 5;
  return months.map((month, i) => ({ month, headcount: base + i + (i % 2) }));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function upcomingBirthdays() {
  return employees
    .filter((e) => e.status === "Active")
    .map((e) => {
      const d = new Date(e.birthday);
      return { ...e, monthIndex: d.getMonth(), day: d.getDate(), monthName: MONTH_NAMES[d.getMonth()]! };
    })
    .sort((a, b) => a.monthIndex - b.monthIndex || a.day - b.day);
}

export function anniversaries() {
  return employees
    .filter((e) => e.status === "Active")
    .map((e) => {
      const d = new Date(e.startDate);
      const years = REFERENCE_NOW.getFullYear() - d.getFullYear();
      return {
        ...e,
        monthIndex: d.getMonth(),
        day: d.getDate(),
        monthName: MONTH_NAMES[d.getMonth()]!,
        years: Math.max(years, 0),
      };
    })
    .sort((a, b) => a.monthIndex - b.monthIndex || a.day - b.day);
}

export function departmentDistribution() {
  return DEPARTMENTS.map((department) => ({
    department,
    active: employees.filter((e) => e.department === department && e.status === "Active").length,
    inactive: employees.filter((e) => e.department === department && e.status !== "Active").length,
  }));
}

function monthsBetween(startDate: string, end: Date) {
  const start = new Date(startDate);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

export function tenureDistribution() {
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
export function monthlyHiringTrend() {
  const out: { month: string; hires: number; exits: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(REFERENCE_NOW.getFullYear(), REFERENCE_NOW.getMonth() - i, 1);
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
export function headcountGrowth() {
  const out: { month: string; headcount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = new Date(REFERENCE_NOW.getFullYear(), REFERENCE_NOW.getMonth() - i + 1, 0);
    const headcount = employees.filter((e) => {
      if (new Date(e.startDate) > end) return false;
      if (e.exitDate && new Date(e.exitDate) <= end) return false;
      return true;
    }).length;
    out.push({
      month: `${MONTH_NAMES[end.getMonth()]!.slice(0, 3)} ${String(end.getFullYear()).slice(2)}`,
      headcount,
    });
  }
  return out;
}
