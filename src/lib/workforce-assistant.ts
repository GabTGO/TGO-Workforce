// Algorithmic answer engine for the support chat widget (see
// src/components/support-chat.tsx and src/routes/api/chat.ts).
//
// The original scaffold wired the chat endpoint to an external model
// gateway (`LOVABLE_API_KEY` / ai.gateway.lovable.dev) that isn't
// configured in this deployment, so every message just failed. Rather than
// depend on an external LLM key, this computes real answers directly from
// the current employee roster using deterministic rules — pattern-match the
// question, run the matching calculation against @/data/employees'
// aggregation helpers, and return a plain-text answer. No network call, no
// API key, and the numbers are always exactly what's in the database.

import {
  DEPARTMENTS,
  OFFICES,
  anniversaries,
  departmentDistribution,
  formatDate,
  metrics,
  officeDistribution,
  statusDistribution,
  tenure,
  tenureDays,
  tenureDistribution,
  upcomingBirthdays,
  type Employee,
} from "@/data/employees";

function pct(part: number, whole: number) {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function listNames(employees: Employee[], limit = 10): string {
  const shown = employees
    .slice(0, limit)
    .map((e) => `- ${e.name} (${e.position}, ${e.office})`);
  const extra = employees.length - shown.length;
  if (extra > 0) shown.push(`...and ${extra} more`);
  return shown.join("\n");
}

/** Very small "N months/days/years" parser for questions like "who joined in
 * the last 3 months" — falls back to null (no explicit window mentioned). */
function parseWindowDays(text: string): number | null {
  const match = text.match(/last\s+(\d+)\s*(day|week|month|year)s?/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "day" ? 1 : unit === "week" ? 7 : unit === "month" ? 30 : 365;
  return n * multiplier;
}

function findEmployeeMatches(text: string, employees: Employee[]): Employee[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return [];
  return employees.filter((e) => {
    const name = e.name.toLowerCase();
    return words.some((w) => name.includes(w));
  });
}

function describeEmployee(e: Employee): string {
  const lines = [
    `${e.name} — ${e.position}`,
    `Office: ${e.office} · Department: ${e.department}`,
    `Status: ${e.status}`,
    `Start date: ${formatDate(e.startDate)} · Tenure: ${tenure(e.startDate, e.exitDate)} (${tenureDays(e.startDate, e.exitDate)} days)`,
  ];
  if (e.exitDate) lines.push(`Exit date: ${formatDate(e.exitDate)}`);
  if (e.birthday) lines.push(`Birthday: ${formatDate(e.birthday)}`);
  return lines.join("\n");
}

const HELP_TEXT = [
  "I can answer questions about your TGO workforce data directly from the directory — no external AI needed. Try things like:",
  "- How many active employees do we have?",
  "- Who joined in the last 3 months?",
  "- Which department has the most people?",
  "- What's the average tenure?",
  "- Any birthdays this month?",
  "- Show me [employee name]",
  "- How do I use the Directory / Analytics / Settings page?",
].join("\n");

const PAGE_HELP: Record<string, string> = {
  directory:
    "The Employee Directory (Directory in the sidebar) lists every employee with search, office/status/department filters, sorting, pagination, CSV/Excel/PDF export, and bulk actions (select rows with the checkboxes, then delete or export just those).",
  analytics:
    "Analytics has charts for headcount trend, office and department distribution, tenure bands, and hiring vs. exits over the last 12 months.",
  "new hires":
    "New Hires lists everyone who joined in the last 12 months, with the same search/filter/pagination controls as the Directory.",
  settings:
    "Settings lets you set a default office for new-hire forms and toggle which notification cards show on your Dashboard (new hires, anniversaries, birthdays).",
  profile:
    "Profile shows your account details (name, email, role, last login) and lets you switch between light and dark mode.",
  import:
    "Import from Excel (on the Directory page) scans a spreadsheet, shows you an editable preview before anything is saved, and lets you fix or remove rows before importing.",
};

export function answerWorkforceQuestion(
  rawQuestion: string,
  employees: Employee[],
): string {
  const q = rawQuestion.trim();
  const text = q.toLowerCase();

  if (!q) return HELP_TEXT;

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text)) {
    return `Hi! ${HELP_TEXT}`;
  }
  if (/\b(help|what can you do|capabilities)\b/.test(text)) {
    return HELP_TEXT;
  }

  // Page / navigation help.
  for (const [page, help] of Object.entries(PAGE_HELP)) {
    if (text.includes(page)) return help;
  }

  const m = metrics(employees);

  // Headcount / active-inactive.
  if (
    /\b(how many|headcount|total)\b.*\bemployees?\b/.test(text) ||
    /\bactive\b.*\bemployees?\b/.test(text)
  ) {
    return [
      `Active: ${m.active}`,
      `Inactive (resigned/terminated): ${m.inactive}`,
      `Total on record: ${m.active + m.inactive}`,
      `PH Eastwood (active): ${m.eastwood} · CO Medellin (active): ${m.medellin}`,
    ].join("\n");
  }

  // New hires / recently joined.
  if (/\bnew hires?\b|\bjoined\b|\brecently hired\b/.test(text)) {
    const windowDays = parseWindowDays(text);
    const list = windowDays
      ? m.newHireList.filter((e) => {
          const days = tenureDays(e.startDate);
          return days <= windowDays;
        })
      : m.newHireList;
    if (list.length === 0)
      return "No one matches that hiring window in the last 12 months.";
    return [
      `${list.length} employee${list.length === 1 ? "" : "s"} ${windowDays ? `in the ${text.match(/last\s+\d+\s*\w+/)?.[0] ?? "last period"}` : "in the last 12 months"}:`,
      listNames(list),
    ].join("\n");
  }

  // Exits.
  if (/\bexits?\b|\bresigned\b|\bterminated\b|\bwho left\b/.test(text)) {
    return `${m.exits} employee${m.exits === 1 ? "" : "s"} exited in the last 12 months (resigned or terminated).`;
  }

  // Department breakdown.
  if (/\bdepartment\b/.test(text)) {
    const dist = departmentDistribution(employees);
    if (/\bmost\b|\bbiggest\b|\blargest\b/.test(text)) {
      const top = [...dist].sort((a, b) => b.active - a.active)[0];
      if (!top || top.active === 0)
        return "No department has any active employees right now.";
      return `${top.department} has the most active employees: ${top.active} (${pct(top.active, m.active)} of active headcount).`;
    }
    return dist
      .map((d) => `${d.department}: ${d.active} active, ${d.inactive} inactive`)
      .join("\n");
  }

  // Office breakdown.
  if (/\boffice\b|\bhub\b|eastwood|medellin/.test(text)) {
    const dist = officeDistribution(employees);
    return dist
      .map((o) => `${o.office}: ${o.active} active, ${o.inactive} inactive`)
      .join("\n");
  }

  // Status breakdown.
  if (/\bstatus\b|\bbreakdown\b/.test(text)) {
    return statusDistribution(employees)
      .map((s) => `${s.status}: ${s.count}`)
      .join("\n");
  }

  // Tenure.
  if (/\btenure\b|\bhow long\b|\byears? (of service|with|at)\b/.test(text)) {
    const active = employees.filter((e) => e.status === "Active");
    if (active.length === 0)
      return "No active employees to calculate tenure from.";
    const avgDays = Math.round(
      active.reduce((sum, e) => sum + tenureDays(e.startDate), 0) /
        active.length,
    );
    const bands = tenureDistribution(employees);
    return [
      `Average tenure across ${active.length} active employees: ${Math.floor(avgDays / 365)}y ${Math.floor((avgDays % 365) / 30)}m (${avgDays} days).`,
      "Tenure bands (active only):",
      bands.map((b) => `${b.band}: ${b.employees}`).join("\n"),
    ].join("\n");
  }

  // Birthdays.
  if (/\bbirthdays?\b/.test(text)) {
    const upcoming = upcomingBirthdays(employees);
    if (upcoming.length === 0)
      return "No birthdays on file for active employees.";
    const scope = /\bmonth\b/.test(text)
      ? "this month"
      : /\bweek\b/.test(text)
        ? "this week"
        : null;
    const now = new Date();
    const filtered = scope
      ? upcoming.filter((e) => {
          if (scope === "this month") return e.monthIndex === now.getMonth();
          const days = tenureDaysFromToday(e.monthIndex, e.day, now);
          return days >= 0 && days <= 7;
        })
      : upcoming;
    if (filtered.length === 0) return `No birthdays ${scope ?? "coming up"}.`;
    return filtered
      .slice(0, 15)
      .map((e) => `${e.name} — ${e.monthName} ${e.day}`)
      .join("\n");
  }

  // Anniversaries.
  if (/\banniversar(y|ies)\b|\bwork anniversary\b/.test(text)) {
    const list = anniversaries(employees).filter((e) => e.years > 0);
    if (list.length === 0)
      return "No upcoming work anniversaries for active employees.";
    return list
      .slice(0, 15)
      .map(
        (e) =>
          `${e.name} — ${e.years} year${e.years === 1 ? "" : "s"} on ${e.monthName} ${e.day}`,
      )
      .join("\n");
  }

  // "list offices/departments" (static reference lists).
  if (
    /\bwhat (offices|departments)\b|\blist (offices|departments)\b/.test(text)
  ) {
    if (text.includes("office")) return `Offices: ${OFFICES.join(", ")}`;
    return `Departments: ${DEPARTMENTS.join(", ")}`;
  }

  // Employee name lookup — try last, since it's the broadest match.
  const matches = findEmployeeMatches(text, employees);
  if (matches.length === 1) {
    return describeEmployee(matches[0]!);
  }
  if (matches.length > 1 && matches.length <= 6) {
    return [
      `Found ${matches.length} employees matching that:`,
      matches.map((e) => `- ${e.name} (${e.position}, ${e.office})`).join("\n"),
      "Ask about one by full name for details.",
    ].join("\n");
  }

  return [
    "I couldn't match that to a specific workforce question.",
    HELP_TEXT,
  ].join("\n\n");
}

function tenureDaysFromToday(
  monthIndex: number,
  day: number,
  now: Date,
): number {
  let next = new Date(now.getFullYear(), monthIndex, day);
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next = new Date(now.getFullYear() + 1, monthIndex, day);
  }
  return Math.round((next.getTime() - now.getTime()) / 86_400_000);
}
