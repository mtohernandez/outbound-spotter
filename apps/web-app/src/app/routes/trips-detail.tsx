import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Empty, EmptyDescription, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@outbound/ui/components/ui/tabs";
import { lazy, Suspense } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { FeatureErrorBoundary } from "@/components/error-boundary/feature-error-boundary";
import { paths } from "@/config/paths";
import { DailyLogSheetsStrip } from "@/features/log-sheet/components/daily-log-sheets-strip";
import { ExportButton } from "@/features/pdf-export/components/export-button";
import { useTripById } from "@/features/trip-planner/api/trip-by-id";
import { useTripPlan } from "@/features/trip-planner/api/trip-plan";
import { AssumptionsBanner } from "@/features/trip-planner/components/assumptions-banner";
import { PlanningDisclaimer } from "@/features/trip-planner/components/planning-disclaimer";
import { ApiError } from "@/lib/api-client";

const TripMap = lazy(() => import("@/features/trip-planner/components/trip-map"));

type TripsDetailView = "map" | "logs";

const VIEW_PARAM = "view";
const DEFAULT_VIEW: TripsDetailView = "map";

function isView(value: string | null): value is TripsDetailView {
  return value === "map" || value === "logs";
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get(VIEW_PARAM);
  const view: TripsDetailView = isView(viewParam) ? viewParam : DEFAULT_VIEW;

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

  const handleViewChange = (next: string): void => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DEFAULT_VIEW) {
          params.delete(VIEW_PARAM);
        } else {
          params.set(VIEW_PARAM, next);
        }
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="px-4 pt-4">
        <AssumptionsBanner tripId={trip.data.id} />
      </div>
      <Tabs
        value={view}
        onValueChange={handleViewChange}
        className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-2">
          <TabsList variant="line">
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="logs">Log sheets</TabsTrigger>
          </TabsList>
          <div className="ms-auto flex items-center">
            <ExportButton tripId={trip.data.id} days={plan.data.days} />
          </div>
        </div>
        <TabsContent
          value="map"
          className="flex min-h-0 min-w-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          <FeatureErrorBoundary scope="trip-map">
            <Suspense fallback={<LoadingState />}>
              <TripMap trip={trip.data} plan={plan.data} active={view === "map"} />
            </Suspense>
          </FeatureErrorBoundary>
        </TabsContent>
        <TabsContent
          value="logs"
          className="flex min-h-0 min-w-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          <FeatureErrorBoundary scope="daily-log-sheets">
            <DailyLogSheetsStrip trip={trip.data} plan={plan.data} />
          </FeatureErrorBoundary>
        </TabsContent>
      </Tabs>
      <div className="border-border border-t px-4 py-2">
        <PlanningDisclaimer />
      </div>
    </div>
  );
}
