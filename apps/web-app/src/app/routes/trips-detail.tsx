import { useAuth } from "@clerk/react";
import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { Skeleton } from "@outbound/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { paths } from "@/config/paths";
import { ApiError, apiFetch } from "@/lib/api-client";

interface TripResponse {
  readonly id: string;
  readonly status: string;
  readonly created_at: string;
  readonly current_label: string;
  readonly current_lat: number;
  readonly current_lon: number;
  readonly pickup_label: string;
  readonly pickup_lat: number;
  readonly pickup_lon: number;
  readonly dropoff_label: string;
  readonly dropoff_lat: number;
  readonly dropoff_lon: number;
  readonly cycle_hours_used: string;
}

export function TripsDetailRoute(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const trip = useQuery<TripResponse>({
    queryKey: ["trip", id],
    enabled: id !== undefined,
    // 404/403/401 are deterministic — don't retry, render the Empty state.
    retry: false,
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<TripResponse>(`/api/trips/${id ?? ""}/`, { token });
    },
  });

  if (trip.isPending) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (trip.isError) {
    const isNotFound = trip.error instanceof ApiError && trip.error.status === 404;
    return (
      <div className="mx-auto flex max-w-2xl px-4 py-12">
        <Empty>
          <EmptyTitle>{isNotFound ? "Trip not found" : "Something went wrong"}</EmptyTitle>
          <EmptyDescription>
            {isNotFound
              ? "This trip doesn't exist or you don't have access to it."
              : trip.error.message}
          </EmptyDescription>
          <Link
            to={paths.tripsNew}
            className="text-primary hover:underline focus-visible:underline"
          >
            Plan a new trip
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-medium tracking-tight">
          Trip {trip.data.id.slice(0, 8)}
        </h1>
        <p className="text-muted-foreground text-sm">
          Created {new Date(trip.data.created_at).toLocaleString()} · status {trip.data.status}
        </p>
      </header>

      <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-display text-sm font-medium tracking-wide uppercase">Route</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Current</dt>
          <dd>{trip.data.current_label}</dd>
          <dt className="text-muted-foreground">Pickup</dt>
          <dd>{trip.data.pickup_label}</dd>
          <dt className="text-muted-foreground">Dropoff</dt>
          <dd>{trip.data.dropoff_label}</dd>
          <dt className="text-muted-foreground">Cycle used</dt>
          <dd>{trip.data.cycle_hours_used} h of 70 h</dd>
        </dl>
      </section>

      <section className="border-border bg-card flex flex-col gap-3 rounded-lg border border-dashed p-6 text-center">
        <h2 className="font-display text-sm font-medium tracking-wide uppercase">Route + logs</h2>
        <p className="text-muted-foreground text-sm">
          Plan computation lands in the next spec. The map and daily log sheets will appear here.
        </p>
        <Skeleton className="mx-auto h-40 w-full max-w-xl" />
      </section>
    </div>
  );
}
