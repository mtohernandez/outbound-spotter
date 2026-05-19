import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import { SignInRoute } from "@/app/routes/sign-in";
import { SignUpRoute } from "@/app/routes/sign-up";
import { SsoCallbackRoute } from "@/app/routes/sso-callback";
import { paths } from "@/config/paths";

const router = createBrowserRouter([
  {
    path: paths.signIn,
    element: <SignInRoute />,
  },
  {
    path: paths.signUp,
    element: <SignUpRoute />,
  },
  {
    path: paths.ssoCallback,
    element: <SsoCallbackRoute />,
  },
  {
    path: "*",
    element: <Navigate to={paths.signIn} replace />,
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
