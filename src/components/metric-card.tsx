import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentAccount } from "@/lib/session";

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
}) {
  const { data: account } = useCurrentAccount();
  const animationsEnabled = account?.animations_enabled ?? true;
  // Keying on the route forces a fresh AnimatedNumber mount (and so a fresh
  // 0→value count-up) every time you navigate to a page that renders this
  // card, independent of whatever the surrounding page tree does or doesn't
  // remount on its own — this card doesn't rely on a parent remounting
  // correctly to animate.
  const pathname = useRouterState({ select: (r) => r.location.pathname });

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
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">
          {typeof value === "number" ? (
            <AnimatedNumber key={pathname} value={value} enabled={animationsEnabled} />
          ) : (
            value
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
