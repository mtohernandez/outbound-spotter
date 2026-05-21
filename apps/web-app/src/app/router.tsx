import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";

import { IndexRedirect } from "@/app/routes/index-redirect";
import { TripsDetailRoute } from "@/app/routes/trips-detail";
import { TripsNewRoute } from "@/app/routes/trips-new";
import { AppShellLayout, type RouteHandle } from "@/components/app-shell/app-shell-layout";
import { paths } from "@/config/paths";
import { TripDetailPanel } from "@/features/trip-planner/components/trip-detail-panel";
import { TripInputPanel } from "@/features/trip-planner/components/trip-input-panel";

// Lazy-loaded so @tanstack/react-table + the saved-trips feature folder stay
// out of the entry chunk for users who never visit /trips (architect + perf
// review m3/m5).
const TripsHistoryRoute = lazy(() =>
  import("@/app/routes/trips-history").then((m) => ({ default: m.TripsHistoryRoute })),
);

function RouteSuspenseFallback(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <SpotterLoader size="lg" />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: paths.root,
    element: <AppShellLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
      {
        path: "trips",
        element: (
          <Suspense fallback={<RouteSuspenseFallback />}>
            <TripsHistoryRoute />
          </Suspense>
        ),
        handle: { title: "Saved trips" } satisfies RouteHandle,
      },
      {
        path: "trips/new",
        element: <TripsNewRoute />,
        handle: { Secondary: TripInputPanel, title: "Plan a trip" } satisfies RouteHandle,
      },
      {
        path: "trips/:id",
        element: <TripsDetailRoute />,
        handle: { Secondary: TripDetailPanel, title: "Trip workspace" } satisfies RouteHandle,
      },
    ],
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
