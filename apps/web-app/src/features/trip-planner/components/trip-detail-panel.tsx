import { SidebarContent, SidebarHeader } from "@outbound/ui/components/ui/sidebar";
import { Skeleton } from "@outbound/ui/components/ui/skeleton";
import { useParams } from "react-router";

import { useTripById } from "@/features/trip-planner/api/trip-by-id";

export function TripDetailPanel(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const trip = useTripById(id);

  if (trip.isPending) {
    return (
      <>
        <SidebarHeader className="gap-1 border-b p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-44" />
        </SidebarHeader>
        <SidebarContent className="gap-3 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </SidebarContent>
      </>
    );
  }

  if (trip.isError) {
    return (
      <>
        <SidebarHeader className="gap-1 border-b p-4">
          <h2 className="font-display text-base font-medium tracking-tight">Trip unavailable</h2>
        </SidebarHeader>
        <SidebarContent className="p-4">
          <p className="text-muted-foreground text-sm">
            This trip doesn&rsquo;t exist or you don&rsquo;t have access to it.
          </p>
        </SidebarContent>
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="gap-1 border-b p-4">
        <h2 className="font-display text-base font-medium tracking-tight">
          Trip {trip.data.id.slice(0, 8)}
        </h2>
        <p className="text-muted-foreground text-xs">
          Created {new Date(trip.data.created_at).toLocaleString()} · status {trip.data.status}
        </p>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Current</dt>
          <dd className="truncate">{trip.data.current_label}</dd>
          <dt className="text-muted-foreground">Pickup</dt>
          <dd className="truncate">{trip.data.pickup_label}</dd>
          <dt className="text-muted-foreground">Dropoff</dt>
          <dd className="truncate">{trip.data.dropoff_label}</dd>
          <dt className="text-muted-foreground">Cycle used</dt>
          <dd>{trip.data.cycle_hours_used} h of 70 h</dd>
        </dl>
      </SidebarContent>
    </>
  );
}
