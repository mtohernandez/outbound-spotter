import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { Skeleton } from "@outbound/ui/components/ui/skeleton";
import { Map } from "lucide-react";
import { Link, useParams } from "react-router";

import { paths } from "@/config/paths";
import { useTripById } from "@/features/trip-planner/api/trip-by-id";
import { ApiError } from "@/lib/api-client";

export function TripsDetailRoute(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const trip = useTripById(id);

  if (trip.isPending) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-full w-full flex-1" />
      </div>
    );
  }

  if (trip.isError) {
    const isNotFound = trip.error instanceof ApiError && trip.error.status === 404;
    return (
      <div className="flex h-full items-center justify-center p-8">
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
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="border-border bg-card text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <Map className="text-muted-foreground/50 size-16" aria-hidden />
        <h2 className="font-display text-foreground text-xl font-medium tracking-tight">
          Route map + daily log sheets
        </h2>
        <p className="max-w-md text-sm">
          The Leaflet map and §395.8 ELD log sheets land in the next spec. The trip summary in the
          left panel is already persisted.
        </p>
      </div>
    </div>
  );
}
