import { createBrowserRouter, RouterProvider } from "react-router";

import { IndexRedirect } from "@/app/routes/index-redirect";
import { TripsDetailRoute } from "@/app/routes/trips-detail";
import { TripsNewRoute } from "@/app/routes/trips-new";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { paths } from "@/config/paths";

const router = createBrowserRouter([
  {
    path: paths.root,
    element: <AppShellLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
      { path: "trips/new", element: <TripsNewRoute /> },
      { path: "trips/:id", element: <TripsDetailRoute /> },
    ],
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
