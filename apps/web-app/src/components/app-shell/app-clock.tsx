import { useTheme } from "@outbound/ui/components/theme/use-theme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@outbound/ui/components/ui/tooltip";
import { Moon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TICK_MS = 30_000;

function formatTime(now: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(now);
}

export function AppClock(): React.ReactElement {
  const [now, setNow] = useState<Date>(() => new Date());
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Re-arm setTimeout each tick (rather than setInterval) so every tick is
    // phase-aligned to the next 30 s boundary. Drift-free + the displayed
    // minute is at most 30 s late, far below the cost of a per-second tick.
    let timer: number | undefined;
    const scheduleNext = (): void => {
      const msToNextBoundary = TICK_MS - (Date.now() % TICK_MS);
      timer = window.setTimeout(() => {
        setNow(new Date());
        scheduleNext();
      }, msToNextBoundary);
    };
    scheduleNext();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const formatted = useMemo(() => formatTime(now), [now]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="text-muted-foreground hidden items-center gap-1.5 font-mono text-xs tabular-nums sm:flex"
          aria-label={`Current home-terminal time ${formatted}`}
        >
          {resolvedTheme === "dark" ? <Moon className="size-3" aria-hidden /> : null}
          <span>{formatted}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Home-terminal time. The planner uses this TZ for all log-day boundaries.
      </TooltipContent>
    </Tooltip>
  );
}
