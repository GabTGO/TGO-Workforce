import { useEffect, useId, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentAccount } from "@/lib/session";
import { cn } from "@/lib/utils";

const COUNT_UP_MS = 700;

/** Animates from the previous numeric value up (or down) to the new one over
 * COUNT_UP_MS, including the very first mount (starts from 0) — that's what
 * makes it visible on every page, not just when a value happens to change
 * while already mounted. Skipped entirely (renders the target immediately)
 * only when the account has turned animations off. */
function AnimatedNumber({ value, enabled }: { value: number; enabled: boolean }) {
  const [displayed, setDisplayed] = useState(enabled ? 0 : value);
  const previous = useRef(enabled ? 0 : value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = previous.current;
    const to = value;
    previous.current = value;
    if (!enabled || from === to) {
      setDisplayed(to);
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      // Ease-out cubic — fast start, settles gently into the final value.
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    }
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value, enabled]);

  return <>{displayed.toLocaleString()}</>;
}

export function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  onClick,
  sparkline,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  /** When provided, the whole card becomes clickable (keyboard-operable too)
   * with a hover affordance — e.g. the Dashboard's cards open a detail modal
   * for the employees behind that number (see @/components/metric-detail-modal
   * and src/routes/index.tsx). Omit for a plain, non-interactive card, same
   * as every existing usage before this prop existed. */
  onClick?: () => void;
  /** Optional recent-history series, oldest → newest (e.g. the last 6
   * months' headcount) — renders as a small animated trend line + a
   * gain/loss badge under the value, matching the "metric card with a graph
   * inside" reference look. Most metric cards across the app have no real
   * day-by-day series behind their number, so this stays opt-in rather than
   * ever faking one — omit it for the plain KPI layout. Needs at least 2
   * points to draw a line. */
  sparkline?: number[];
}) {
  const { data: account } = useCurrentAccount();
  const animationsEnabled = account?.animations_enabled ?? true;
  // Keying on the route forces a fresh AnimatedNumber mount (and so a fresh
  // 0→value count-up) every time you navigate to a page that renders this
  // card, independent of whatever the surrounding page tree does or doesn't
  // remount on its own — this card doesn't rely on a parent remounting
  // correctly to animate.
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const gradientId = useId();

  const hasTrend = !!sparkline && sparkline.length > 1;
  const first = hasTrend ? sparkline[0]! : 0;
  const last = hasTrend ? sparkline[sparkline.length - 1]! : 0;
  const changePercent = hasTrend && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const trendUp = (changePercent ?? 0) >= 0;
  const trendColor = trendUp ? "var(--chart-1)" : "var(--destructive)";
  const chartData = hasTrend ? sparkline.map((v, i) => ({ i, v })) : [];

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={
        onClick
          ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40"
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div className="text-3xl font-semibold tracking-tight">
            {typeof value === "number" ? (
              <AnimatedNumber key={pathname} value={value} enabled={animationsEnabled} />
            ) : (
              value
            )}
          </div>
          {changePercent !== null && (
            <span
              className={cn(
                "mb-0.5 flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                trendUp
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(changePercent).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        {hasTrend && (
          <div
            key={`${pathname}-${animationsEnabled}`}
            className="-mx-1 mt-3 h-12 w-[calc(100%+0.5rem)]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={trendColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={animationsEnabled}
                  animationDuration={900}
                  animationEasing="ease-out"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
