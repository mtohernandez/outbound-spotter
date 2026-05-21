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
    // Align the first tick with the next minute boundary so the displayed
    // minute changes promptly, then settle into a 30 s cadence — minutes
    // never advance more than ~30 s late, but the repaint cost is far below
    // a per-second tick.
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: number | undefined;
    const initial = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => {
        setNow(new Date());
      }, TICK_MS);
    }, msToNextMinute);
    return () => {
      window.clearTimeout(initial);
      if (interval !== undefined) window.clearInterval(interval);
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
