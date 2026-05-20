import { createBrowserRouter, RouterProvider } from "react-router";

import { IndexRedirect } from "@/app/routes/index-redirect";
import { TripsDetailRoute } from "@/app/routes/trips-detail";
import { TripsNewRoute } from "@/app/routes/trips-new";
import { AppShellLayout, type RouteHandle } from "@/components/app-shell/app-shell-layout";
import { paths } from "@/config/paths";
import { TripDetailPanel } from "@/features/trip-planner/components/trip-detail-panel";
import { TripInputPanel } from "@/features/trip-planner/components/trip-input-panel";

const router = createBrowserRouter([
  {
    path: paths.root,
    element: <AppShellLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
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
