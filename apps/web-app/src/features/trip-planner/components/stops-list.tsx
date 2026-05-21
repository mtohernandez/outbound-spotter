import { ArrowDown, Flag } from "lucide-react";
import { Fragment } from "react";

import { CurrentLocationDot } from "@/features/trip-planner/components/map/current-location-dot";
import { StopKindIcon } from "@/features/trip-planner/components/map/stop-kind-icon";
import { STOP_KIND_META } from "@/features/trip-planner/components/map/stop-kind-labels";
import type { StopKind, TripPlan, TripStop } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { setHoveredStop, useHoveredStopId } from "@/features/trip-planner/state/hovered-stop";
import { formatDistance } from "@/features/trip-planner/utils/format-distance";
import { formatDuration } from "@/features/trip-planner/utils/format-duration";

// Driver-input stops (Pickup + Dropoff) sit ON the route's trunk line — they
// are the trip's defining waypoints. Everything else (break, sleeper, fuel,
// restart) is planner-inserted and renders as a short branch deviating from
// the trunk, then merging back: same visual grammar as a gitgraph, applied to
// a route. Senior-review fix #2.
const TRUNK_STOP_KINDS: ReadonlySet<StopKind> = new Set(["pickup", "dropoff"]);
function isOnTrunk(kind: StopKind): boolean {
  return TRUNK_STOP_KINDS.has(kind);
}

interface Props {
  readonly trip: TripResponse;
  readonly plan: TripPlan;
}

interface TimeFormatter {
  readonly format: (date: Date) => string;
}

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
  return new Date(new Date(last.scheduled_at).valueOf() + last.duration_s * 1000);
}

// Stop labels reused for the route_segments-derived drive legs (segments lack
// stop names; they're indexed by polyline coordinate, matching the input
// triple in route order).
const LEG_LABELS = ["Current", "Pickup", "Dropoff"];

export function StopsList({ trip, plan }: Props): React.ReactElement {
  const hoveredStopId = useHoveredStopId();
  const fmt = timeFormatter(plan.home_terminal_tz);
  const arrival = computeArrival(plan);
  const { distance_mi, duration_s } = trip.route_summary;

  return (
    <div className="flex flex-col gap-3">
      <SummaryHeader
        distance={distance_mi}
        durationSeconds={duration_s}
        departure={fmt.format(new Date(trip.start_at))}
        arrival={arrival ? fmt.format(arrival) : null}
      />
      <ol
        className="route-stops relative flex flex-col gap-1"
        aria-label="Trip stops in chronological order"
      >
        {/*
          Decorative trunk — vertical line connecting Start → Arrive through every icon.
          Driver-input stops (pickup/dropoff) sit ON the trunk; planner-inserted stops
          render as branches that deviate right (.route-node[data-branch="true"]) and
          merge back. Aligned with the icon column center: px-2 (0.5rem) padding-left
          + half of w-5 (0.625rem) = 1.125rem.
        */}
        <span
          aria-hidden="true"
          className="route-trunk bg-border/70 pointer-events-none absolute top-5 bottom-5 left-4.5 w-px -translate-x-1/2"
        />
        <StartRow time={fmt.format(new Date(trip.start_at))} label={trip.current_label} />
        {plan.stops.map((stop, index) => {
          // The matching ORS leg sits BEFORE this stop — leg index aligns with
          // the input triple, but `plan.stops` interleaves planner-inserted
          // events. Render driver-input drive legs (current→pickup, pickup→
          // dropoff) explicitly using `route_segments`; planner-inserted
          // breaks/fuels/sleepers inline without their own segment row.
          const driverInput = stop.kind === "pickup" || stop.kind === "dropoff";
          const segment = driverInput
            ? trip.route_segments[Math.min(index, trip.route_segments.length - 1)]
            : undefined;
          const fromLabel = LEG_LABELS[stop.kind === "pickup" ? 0 : 1] ?? "";
          const toLabel = LEG_LABELS[stop.kind === "pickup" ? 1 : 2] ?? "";
          return (
            <Fragment key={stop.id}>
              {segment ? (
                <DriveSegmentRow
                  miles={segment.distance_mi}
                  seconds={segment.duration_s}
                  fromLabel={fromLabel}
                  toLabel={toLabel}
                />
              ) : null}
              <StopRow
                stop={stop}
                time={fmt.format(new Date(stop.scheduled_at))}
                isHovered={hoveredStopId === stop.id}
              />
            </Fragment>
          );
        })}
        {arrival ? <ArrivalRow time={fmt.format(arrival)} /> : null}
      </ol>
    </div>
  );
}

function SummaryHeader({
  distance,
  durationSeconds,
  departure,
  arrival,
}: {
  readonly distance: number;
  readonly durationSeconds: number;
  readonly departure: string;
  readonly arrival: string | null;
}): React.ReactElement {
  return (
    <div className="bg-accent/30 border-border/60 flex flex-col gap-1 rounded-md border px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-base font-medium tabular-nums">
          {formatDuration(durationSeconds)}
        </span>
        <span className="text-muted-foreground text-sm tabular-nums">
          · {formatDistance(distance)}
        </span>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className="text-foreground font-mono">{departure}</span>
        {arrival ? (
          <>
            <span aria-hidden="true">→</span>
            <span className="text-foreground font-mono">{arrival}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DriveSegmentRow({
  miles,
  seconds,
  fromLabel,
  toLabel,
}: {
  readonly miles: number;
  readonly seconds: number;
  readonly fromLabel: string;
  readonly toLabel: string;
}): React.ReactElement {
  return (
    <li className="text-muted-foreground flex items-center gap-3 px-2 py-1 text-xs">
      <span
        className="route-node text-muted-foreground/70 relative flex w-5 shrink-0 justify-center"
        data-branch="false"
        aria-hidden="true"
      >
        <ArrowDown className="size-3.5" />
      </span>
      <span className="font-mono">
        {formatDuration(seconds)} · {formatDistance(miles)}
      </span>
      <span className="truncate text-xs">
        {fromLabel} → {toLabel}
      </span>
    </li>
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
        className="route-node relative mt-0.5 flex w-5 shrink-0 justify-center"
        data-branch="false"
        aria-hidden="true"
      >
        <CurrentLocationDot className="size-5" />
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
  const branch = !isOnTrunk(stop.kind);
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
        <span
          className="route-node relative mt-0.5 flex shrink-0"
          data-branch={branch ? "true" : "false"}
          aria-hidden="true"
        >
          <StopKindIcon kind={stop.kind} />
        </span>
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
        className="route-node text-primary relative mt-0.5 flex w-5 shrink-0 justify-center"
        data-branch="false"
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
