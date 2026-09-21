// A more deliberate "real work is happening" indicator than a bare spinner —
// two staggered rings ping outward from a centered icon (radar/sonar-style,
// fitting for "scanning" or "backing up" specifically, not just any generic
// wait) plus three bouncing dots underneath. Built entirely from Tailwind's
// built-in animate-ping/animate-bounce utilities — no custom keyframes.
import type { LucideIcon } from "lucide-react";

export function LoadingPulse({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/25" />
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20 [animation-delay:0.5s]" />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
      </div>
    </div>
  );
}
