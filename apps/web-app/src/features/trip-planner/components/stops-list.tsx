import { CircleDot, Flag } from "lucide-react";

import { StopKindIcon } from "@/features/trip-planner/components/map/stop-kind-icon";
import { STOP_KIND_META } from "@/features/trip-planner/components/map/stop-kind-labels";
import type { TripPlan, TripStop } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { setHoveredStop, useHoveredStopId } from "@/features/trip-planner/state/hovered-stop";
import { formatDuration } from "@/features/trip-planner/utils/format-duration";

interface Props {
  readonly trip: TripResponse;
  readonly plan: TripPlan;
}

interface TimeFormatter {
  readonly format: (date: Date) => string;
}

// Module-cached so we allocate one formatter per timezone, not per render.
const timeFormatterCache = new Map<string, TimeFormatter>();
function timeFormatter(tz: string): TimeFormatter {
  const cached = timeFormatterCache.get(tz);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  timeFormatterCache.set(tz, fmt);
  return fmt;
}

function computeArrival(plan: TripPlan): Date | null {
  if (plan.stops.length === 0) return null;
  const last = plan.stops[plan.stops.length - 1];
  if (!last) return null;
  const end = new Date(last.scheduled_at).valueOf() + last.duration_s * 1000;
  return new Date(end);
}

export function StopsList({ trip, plan }: Props): React.ReactElement {
  const hoveredStopId = useHoveredStopId();
  const tz = plan.home_terminal_tz;
  const fmt = timeFormatter(tz);
  const arrival = computeArrival(plan);

  return (
    <ol className="relative flex flex-col gap-1" aria-label="Trip stops in chronological order">
      <StartRow time={fmt.format(new Date(trip.start_at))} label={trip.current_label} />
      {plan.stops.map((stop) => (
        <StopRow
          key={stop.id}
          stop={stop}
          time={fmt.format(new Date(stop.scheduled_at))}
          isHovered={hoveredStopId === stop.id}
        />
      ))}
      {arrival ? <ArrivalRow time={fmt.format(arrival)} /> : null}
    </ol>
  );
}

function StartRow({
  time,
  label,
}: {
  readonly time: string;
  readonly label: string;
}): React.ReactElement {
  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-1.5">
      <span
        className="text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <CircleDot className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground font-mono text-xs">{time} · Start</span>
        <span className="truncate text-sm">{label}</span>
      </div>
    </li>
  );
}

function StopRow({
  stop,
  time,
  isHovered,
}: {
  readonly stop: TripStop;
  readonly time: string;
  readonly isHovered: boolean;
}): React.ReactElement {
  const meta = STOP_KIND_META[stop.kind];
  return (
    <li>
      <button
        type="button"
        data-stop-kind={stop.kind}
        data-hovered={isHovered ? "true" : "false"}
        onMouseEnter={() => {
          setHoveredStop(stop.id);
        }}
        onMouseLeave={() => {
          setHoveredStop(null);
        }}
        onFocus={() => {
          setHoveredStop(stop.id);
        }}
        onBlur={() => {
          setHoveredStop(null);
        }}
        className="hover:bg-accent/60 focus-visible:ring-ring data-[hovered=true]:bg-accent/80 flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2"
      >
        <StopKindIcon kind={stop.kind} className="mt-0.5 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-xs">
              <span className="text-foreground">{time}</span>
              <span className="text-muted-foreground"> · {meta.label}</span>
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              {formatDuration(stop.duration_s)}
            </span>
          </div>
          <span className="truncate text-sm">
            {stop.label.trim().length > 0
              ? stop.label
              : `${stop.lat.toFixed(4)}, ${stop.lon.toFixed(4)}`}
          </span>
          {meta.reason === "" ? null : (
            <span className="text-muted-foreground text-xs leading-snug">{meta.reason}</span>
          )}
        </div>
      </button>
    </li>
  );
}

function ArrivalRow({ time }: { readonly time: string }): React.ReactElement {
  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-1.5">
      <span
        className="text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <Flag className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground font-mono text-xs">{time} · Arrive</span>
        <span className="text-sm">Trip complete</span>
      </div>
    </li>
  );
}
