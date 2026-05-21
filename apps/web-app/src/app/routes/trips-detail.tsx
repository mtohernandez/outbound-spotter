import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router";

import { paths } from "@/config/paths";
import { useTripById } from "@/features/trip-planner/api/trip-by-id";
import { useTripPlan } from "@/features/trip-planner/api/trip-plan";
import { ApiError } from "@/lib/api-client";

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
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Suspense fallback={<LoadingState />}>
        <TripMap trip={trip.data} plan={plan.data} />
      </Suspense>
    </div>
  );
}
