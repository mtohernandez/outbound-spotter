import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { Skeleton } from "@outbound/ui/components/ui/skeleton";
import { Link, useParams } from "react-router";

import { paths } from "@/config/paths";
import { useTripById } from "@/features/trip-planner/api/trip-by-id";
import { RouteSummary } from "@/features/trip-planner/components/route-summary";
import { ApiError } from "@/lib/api-client";

export function TripsDetailRoute(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const trip = useTripById(id);

  if (trip.isPending) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Skeleton className="size-16 rounded-full" />
      </div>
    );
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
            to={paths.tripsNew satisfies string}
            className="text-primary hover:underline focus-visible:underline"
          >
            Plan a new trip
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <RouteSummary trip={trip.data} />
    </div>
  );
}
