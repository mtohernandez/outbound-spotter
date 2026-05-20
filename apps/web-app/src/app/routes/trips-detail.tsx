import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router";

import { paths } from "@/config/paths";
import { useTripById } from "@/features/trip-planner/api/trip-by-id";
import { useTripPlan } from "@/features/trip-planner/api/trip-plan";
import { ApiError } from "@/lib/api-client";

// Lazy-loads the leaflet-vendor chunk only on /trips/:id. The default export
// pairs with React.lazy's default-import resolution.
const TripMap = lazy(() => import("@/features/trip-planner/components/trip-map"));

function LoadingState(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <SpotterLoader size="lg" />
    </div>
  );
}

export function TripsDetailRoute(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const trip = useTripById(id);
  const plan = useTripPlan(id);

  if (trip.isPending || plan.isPending) {
    return <LoadingState />;
  }

  // Trip 404 — the row itself is gone (or never owned). Offer recovery (plan
  // a new trip); the user has no way back to this id.
  if (trip.isError) {
    const isNotFound = trip.error instanceof ApiError && trip.error.status === 404;
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Empty>
          <EmptyTitle>{isNotFound ? "Trip not found" : "Something went wrong"}</EmptyTitle>
          <EmptyDescription>
            {isNotFound
              ? "This trip doesn't exist or you don't have access to it."
              : trip.error.message}
          </EmptyDescription>
          <Link
            to={paths.tripsNew}
            className="text-primary focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Plan a new trip
          </Link>
        </Empty>
      </div>
    );
  }

  // Plan-missing — under spec-06's atomic contract this cannot happen for a
  // post-spec-06 trip; if it does, it's a data-integrity event rather than a
  // UX condition. No "plan a new trip" link (the trip exists; a new one is
  // the wrong action).
  if (plan.isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Empty>
          <EmptyTitle>Trip data missing</EmptyTitle>
          <EmptyDescription>
            The plan for this trip didn&rsquo;t load. Try refreshing, or contact support if this
            persists.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Suspense fallback={<LoadingState />}>
        <TripMap trip={trip.data} plan={plan.data} />
      </Suspense>
    </div>
  );
}
