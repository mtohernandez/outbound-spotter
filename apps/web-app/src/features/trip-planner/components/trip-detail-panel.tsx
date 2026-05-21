import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@outbound/ui/components/ui/sidebar";
import { Skeleton } from "@outbound/ui/components/ui/skeleton";
import { useParams } from "react-router";

import { useTripById } from "@/features/trip-planner/api/trip-by-id";
import { useTripPlan } from "@/features/trip-planner/api/trip-plan";
import { StopsList } from "@/features/trip-planner/components/stops-list";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";

// Strip ", USA" off the country suffix so the short header reads cleanly
// ("Richmond, VA → Newark, NJ", not "Richmond, VA, USA → Newark, NJ, USA").
function shortPlace(label: string): string {
  return label.replace(/,\s*USA$/i, "");
}

function RouteHeading({ trip }: { readonly trip: TripResponse }): React.ReactElement {
  return (
    <h2 className="font-display flex flex-wrap items-baseline gap-1.5 text-base font-medium tracking-tight">
      <span className="truncate">{shortPlace(trip.current_label)}</span>
      <span className="text-muted-foreground" aria-hidden="true">
        →
      </span>
      <span className="truncate">{shortPlace(trip.dropoff_label)}</span>
    </h2>
  );
}

export function TripDetailPanel(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const trip = useTripById(id);
  const plan = useTripPlan(id);

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

  const data = trip.data;

  return (
    <>
      <SidebarHeader className="gap-1 border-b p-4">
        <RouteHeading trip={data} />
        <p className="text-muted-foreground text-xs">
          {data.cycle_hours_used} h used · 70-hour / 8-day cycle
        </p>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarGroup className="px-0">
          <SidebarGroupLabel>Route</SidebarGroupLabel>
          <SidebarGroupContent>
            {plan.isPending ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : plan.isError ? (
              <p className="text-muted-foreground text-xs">Route stops unavailable.</p>
            ) : (
              <StopsList trip={data} plan={plan.data} />
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
