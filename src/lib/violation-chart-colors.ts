// Chart color/config mapping for the attendance violation domain's charts
// (violation type breakdown, office breakdown) — ported from the standalone
// attendance app's src/lib/chart-colors.ts, but adapted to this app's
// existing shared chart convention instead of a raw hex palette.
//
// Unlike the source app (a plain Vite SPA that had to hand-roll its own
// CHART_PALETTE hex twins for Recharts — see that file's comment on why
// oklch() vars don't parse there), this app already has that solved: every
// chart here goes through @/components/ui/chart's <ChartContainer /> +
// ChartConfig, which resolves `var(--chart-N)` design tokens into concrete
// per-theme colors for Recharts automatically (see @/components/
// workforce-charts.tsx for the established pattern). So this file just
// supplies the ChartConfig objects for violation-specific series instead of
// re-deriving its own color values.

import type { ChartConfig } from "@/components/ui/chart";

export const VIOLATION_TYPE_CHART_CONFIG = {
  count: { label: "Records" },
  "Late Arrival": { label: "Late Arrival", color: "var(--chart-1)" },
  "Call Out": { label: "Call Out", color: "var(--chart-2)" },
  "Early Out": { label: "Early Out", color: "var(--chart-3)" },
  NCNS: { label: "NCNS", color: "var(--chart-4)" },
  Other: { label: "Other", color: "var(--chart-5)" },
} satisfies ChartConfig;

export const VIOLATION_OFFICE_CHART_CONFIG = {
  count: { label: "Records", color: "var(--chart-1)" },
} satisfies ChartConfig;

export const VIOLATION_TYPE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
