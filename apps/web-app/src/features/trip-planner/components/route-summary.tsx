import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { formatDistance } from "@/features/trip-planner/utils/format-distance";
import { formatDuration } from "@/features/trip-planner/utils/format-duration";
import { formatStartAt } from "@/features/trip-planner/utils/format-start-at";

// 3 input coordinates → 2 segments. Legs are labeled by their position in
// the route (current → pickup, pickup → dropoff). `segment.from_index` /
// `to_index` are polyline-coordinate indices that ORS uses for slicing the
// geometry, not driver-facing stop indices.
const STOP_LABELS = ["Current", "Pickup", "Dropoff"];

// Panel-mode summary mounted inside TripDetailPanel's Route SidebarGroup
// (spec 07). Returns the <dl> body only; the caller owns the <SidebarGroupLabel>.
export function RouteSummary({ trip }: { readonly trip: TripResponse }): React.ReactElement {
  const { distance_mi, duration_s } = trip.route_summary;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Total</dt>
      <dd className="font-mono">
        {formatDistance(distance_mi)} · {formatDuration(duration_s)}
      </dd>
      {trip.route_segments.map((segment, legIndex) => {
        const fromLabel = STOP_LABELS[legIndex] ?? `Stop ${String(legIndex)}`;
        const toLabel = STOP_LABELS[legIndex + 1] ?? `Stop ${String(legIndex + 1)}`;
        return (
          // `display: contents` lets the inner <dt>/<dd> participate in the
          // outer grid while keeping the legible key as a React element.
          <div
            key={`${String(segment.from_index)}-${String(segment.to_index)}`}
            className="contents"
          >
            <dt className="text-muted-foreground">
              {fromLabel} → {toLabel}
            </dt>
            <dd className="font-mono">
              {formatDistance(segment.distance_mi)} · {formatDuration(segment.duration_s)}
            </dd>
          </div>
        );
      })}
      <dt className="text-muted-foreground">Departs</dt>
      <dd className="font-mono">{formatStartAt(trip.start_at)}</dd>
    </dl>
  );
}
