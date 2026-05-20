import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Card, CardContent } from "@outbound/ui/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { Link } from "react-router";

import { paths } from "@/config/paths";
import type {
  RouteErrorCode,
  TripPlanned,
  TripResponse,
} from "@/features/trip-planner/schemas/trip-response";
import { formatDistance } from "@/features/trip-planner/utils/format-distance";
import { formatDuration } from "@/features/trip-planner/utils/format-duration";

const ROUTE_ERROR_COPY: Record<RouteErrorCode, { title: string; body: string }> = {
  rate_limit_per_minute: {
    title: "Routing service is busy",
    body: "We hit the per-minute routing quota. Try again in a moment.",
  },
  rate_limit_daily: {
    title: "Daily routing quota exhausted",
    body: "The routing service is rate-limited until tomorrow. Try again then.",
  },
  upstream: {
    title: "Couldn't reach the routing service",
    body: "The routing service didn't respond. Try again in a moment.",
  },
  validation: {
    title: "Couldn't plan this route",
    body: "The routing service refused these coordinates. Try slightly different addresses.",
  },
};

// 3 input coordinates → 2 segments. Indices map to driver-facing waypoint
// labels; this is intentionally generic (not pulled from trip.{current,pickup,dropoff}_label)
// so the per-leg row label stays at constant width across long addresses.
const STOP_LABELS = ["Current", "Pickup", "Dropoff"];

export function RouteSummary({ trip }: { readonly trip: TripResponse }): React.ReactElement {
  switch (trip.status) {
    case "planning":
      return <SpotterLoader size="lg" />;
    case "failed":
      return <FailedSummary code={trip.route_error_code} />;
    case "planned":
      return <PlannedSummary trip={trip} />;
  }
}

function PlannedSummary({ trip }: { readonly trip: TripPlanned }): React.ReactElement {
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
            {trip.route_segments.map((segment) => {
              const fromLabel =
                STOP_LABELS[segment.from_index] ?? `Stop ${String(segment.from_index)}`;
              const toLabel = STOP_LABELS[segment.to_index] ?? `Stop ${String(segment.to_index)}`;
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

function FailedSummary({ code }: { readonly code: RouteErrorCode }): React.ReactElement {
  const copy = ROUTE_ERROR_COPY[code];
  return (
    <Empty>
      <EmptyTitle>{copy.title}</EmptyTitle>
      <EmptyDescription>{copy.body}</EmptyDescription>
      <Link
        to={paths.tripsNew satisfies string}
        className="text-primary focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        Plan a new trip
      </Link>
    </Empty>
  );
}
