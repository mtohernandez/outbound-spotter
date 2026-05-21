import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { lazy, Suspense } from "react";

// Lazy-loads the leaflet chunk only when the driver lands on /trips/new (or
// /trips/:id); other routes (sign-in, redirect) ship without it.
const TripPreviewMap = lazy(() => import("@/features/trip-planner/components/trip-preview-map"));

function LoadingState(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <SpotterLoader size="lg" />
    </div>
  );
}

export function TripsNewRoute(): React.ReactElement {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Suspense fallback={<LoadingState />}>
        <TripPreviewMap />
      </Suspense>
    </div>
  );
}
