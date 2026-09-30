import { useEffect, useId, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer } from "recharts";
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

// --- Decorative mini-graphs ------------------------------------------------
// Most metric cards across the app only have a *current* count in the
// database — no stored month-by-month history — so there's no genuine trend
// to plot. Rather than leave those cards graph-less, they get a soft,
// deterministic ornamental mini-graph, seeded off the card title so it's
// stable across renders but *varied between cards*: the seed also picks which
// shape (smooth area / bars / line) a card gets, so a grid of cards doesn't
// read as one repeated squiggle. It's drawn faint and carries NO percentage
// badge — card chrome, not real data. Only cards given a real `sparkline` get
// the strong colored line + a gain/loss badge.

type ChartKind = "area" | "bar" | "line";
const DECORATIVE_KINDS: ChartKind[] = ["area", "bar", "line"];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth, gentle wave (sine-based, not a random walk) so decorative graphs
 * read as a calm trend rather than jagged spaghetti. Seeded phase/amplitude/
 * drift/frequency give each card its own distinct-but-tidy shape. */
function decorativeCurve(seed: string, points: number): number[] {
  const rand = mulberry32(hashSeed(seed));
  const phase = rand() * Math.PI * 2;
  const freq = 1 + rand() * 1.4;
  const amp = 0.16 + rand() * 0.12;
  const drift = (rand() - 0.4) * 0.4;
  const out: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const t = points > 1 ? i / (points - 1) : 0;
    let v = 0.5 + Math.sin(phase + t * Math.PI * freq) * amp + drift * (t - 0.5);
    v = Math.max(0.12, Math.min(0.92, v));
    out.push(v);
  }
  return out;
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
  /** A REAL recent-history series, oldest → newest (e.g. the last 6 months'
   * headcount) — renders as a strong animated trend line + a gain/loss badge.
   * Omit it and the card still shows an animated line, but a faint decorative
   * one with no badge (see decorativeCurve above), since most metrics have no
   * genuine series stored behind them. Needs at least 2 points. */
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

  const isReal = !!sparkline && sparkline.length > 1;
  // Decorative cards pick their shape from the same seed as the curve, so a
  // grid shows a mix of areas, bars and lines rather than one repeated shape.
  const kind: ChartKind = isReal
    ? "area"
    : DECORATIVE_KINDS[hashSeed(title) % DECORATIVE_KINDS.length]!;
  // Bars read cleaner with fewer, chunkier columns; lines/areas want more
  // points to look smooth.
  const points = kind === "bar" ? 7 : 10;
  const series = isReal ? sparkline : decorativeCurve(title, points);
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const changePercent = isReal && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const trendUp = (changePercent ?? 0) >= 0;
  const lineColor = isReal ? (trendUp ? "var(--chart-1)" : "var(--destructive)") : "var(--primary)";
  const chartData = series.map((v, i) => ({ i, v }));

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
      className={cn(
        "group overflow-hidden",
        onClick && "cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40",
      )}
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
        <div
          key={`${pathname}-${animationsEnabled}`}
          className={cn("-mx-1 mt-3 h-12 w-[calc(100%+0.5rem)]", !isReal && "opacity-60")}
        >
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <Bar
                  dataKey="v"
                  fill={lineColor}
                  fillOpacity={isReal ? 0.8 : 0.5}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={animationsEnabled}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            ) : kind === "line" ? (
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={isReal ? 2 : 1.5}
                  strokeOpacity={isReal ? 1 : 0.65}
                  isAnimationActive={animationsEnabled}
                  animationDuration={900}
                  animationEasing="ease-out"
                  dot={false}
                />
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={isReal ? 0.35 : 0.2} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={isReal ? 2 : 1.5}
                  strokeOpacity={isReal ? 1 : 0.65}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={animationsEnabled}
                  animationDuration={900}
                  animationEasing="ease-out"
                  dot={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
