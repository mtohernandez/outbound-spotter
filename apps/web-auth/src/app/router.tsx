import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import { ForgotPasswordRoute } from "@/app/routes/forgot-password";
import { IndexRoute } from "@/app/routes/index";
import { SignInRoute } from "@/app/routes/sign-in";
import { SignUpRoute } from "@/app/routes/sign-up";
import { SsoCallbackRoute } from "@/app/routes/sso-callback";
import { RouteErrorElement } from "@/components/error-boundary/route-error-element";
import { paths } from "@/config/paths";

const router = createBrowserRouter([
  { path: paths.root, element: <IndexRoute />, errorElement: <RouteErrorElement /> },
  { path: paths.signIn, element: <SignInRoute />, errorElement: <RouteErrorElement /> },
  { path: paths.signUp, element: <SignUpRoute />, errorElement: <RouteErrorElement /> },
  {
    path: paths.forgotPassword,
    element: <ForgotPasswordRoute />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: paths.ssoCallback,
    element: <SsoCallbackRoute />,
    errorElement: <RouteErrorElement />,
  },
  { path: "*", element: <Navigate to="/sign-in" replace /> },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
