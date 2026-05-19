import { createBrowserRouter, RouterProvider } from "react-router";

import { RootRoute } from "@/app/routes/root";
import { paths } from "@/config/paths";

const router = createBrowserRouter([
  {
    path: paths.root,
    element: <RootRoute />,
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
