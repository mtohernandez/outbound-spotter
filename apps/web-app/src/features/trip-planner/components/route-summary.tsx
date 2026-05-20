import { Card, CardContent } from "@outbound/ui/components/ui/card";

import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { formatDistance } from "@/features/trip-planner/utils/format-distance";
import { formatDuration } from "@/features/trip-planner/utils/format-duration";

// 3 input coordinates → 2 segments. Legs are labeled by their position in
// the route (current → pickup, pickup → dropoff). `segment.from_index` /
// `to_index` are polyline-coordinate indices that ORS uses for slicing the
// geometry, not driver-facing stop indices.
const STOP_LABELS = ["Current", "Pickup", "Dropoff"];

export function RouteSummary({ trip }: { readonly trip: TripResponse }): React.ReactElement {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-4 p-6">
        <dl>
          <div role="group" className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Total distance
              </dt>
              <dd className="font-mono text-2xl">
                {formatDistance(trip.route_summary.distance_mi)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Total duration
              </dt>
              <dd className="font-mono text-2xl">
                {formatDuration(trip.route_summary.duration_s)}
              </dd>
            </div>
          </div>
          <div role="group" className="border-border mt-4 flex flex-col gap-2 border-t pt-4">
            {trip.route_segments.map((segment, legIndex) => {
              const fromLabel = STOP_LABELS[legIndex] ?? `Stop ${String(legIndex)}`;
              const toLabel = STOP_LABELS[legIndex + 1] ?? `Stop ${String(legIndex + 1)}`;
              return (
                <div
                  key={`${String(segment.from_index)}-${String(segment.to_index)}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="text-muted-foreground text-xs">
                    {fromLabel} → {toLabel}
                  </dt>
                  <dd className="font-mono text-sm">
                    {formatDistance(segment.distance_mi)} · {formatDuration(segment.duration_s)}
                  </dd>
                </div>
              );
            })}
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
