import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";

import { IndexRedirect } from "@/app/routes/index-redirect";
import { NotFoundRoute } from "@/app/routes/not-found";
import { TripsDetailRoute } from "@/app/routes/trips-detail";
import { TripsNewRoute } from "@/app/routes/trips-new";
import { AppShellLayout, type RouteHandle } from "@/components/app-shell/app-shell-layout";
import { RouteErrorElement } from "@/components/error-boundary/route-error-element";
import { paths } from "@/config/paths";
import { TripDetailPanel } from "@/features/trip-planner/components/trip-detail-panel";
import { TripInputPanel } from "@/features/trip-planner/components/trip-input-panel";

// Lazy-loaded so @tanstack/react-table + the saved-trips feature folder stay
// out of the entry chunk for users who never visit /trips (architect + perf
// review m3/m5).
const TripsHistoryRoute = lazy(() =>
  import("@/app/routes/trips-history").then((m) => ({ default: m.TripsHistoryRoute })),
);

// Same pattern for /exports — keeps the exports feature folder + react-table
// re-use out of the entry chunk on routes that don't need them (spec 10
// phase 3).
const ExportsHistoryRoute = lazy(() =>
  import("@/app/routes/exports-history").then((m) => ({ default: m.ExportsHistoryRoute })),
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
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: <IndexRedirect />, errorElement: <RouteErrorElement /> },
      {
        path: "trips",
        element: (
          <Suspense fallback={<RouteSuspenseFallback />}>
            <TripsHistoryRoute />
          </Suspense>
        ),
        errorElement: <RouteErrorElement />,
        handle: { title: "Saved trips" } satisfies RouteHandle,
      },
      {
        path: "trips/new",
        element: <TripsNewRoute />,
        errorElement: <RouteErrorElement />,
        handle: { Secondary: TripInputPanel, title: "Plan a trip" } satisfies RouteHandle,
      },
      {
        path: "trips/:id",
        element: <TripsDetailRoute />,
        errorElement: <RouteErrorElement />,
        handle: { Secondary: TripDetailPanel, title: "Trip workspace" } satisfies RouteHandle,
      },
      {
        path: "exports",
        element: (
          <Suspense fallback={<RouteSuspenseFallback />}>
            <ExportsHistoryRoute />
          </Suspense>
        ),
        errorElement: <RouteErrorElement />,
        handle: { title: "Exports" } satisfies RouteHandle,
      },
      { path: "*", element: <NotFoundRoute />, errorElement: <RouteErrorElement /> },
    ],
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
