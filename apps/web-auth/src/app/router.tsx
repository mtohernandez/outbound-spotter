import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import { ForgotPasswordRoute } from "@/app/routes/forgot-password";
import { IndexRoute } from "@/app/routes/index";
import { SignInRoute } from "@/app/routes/sign-in";
import { SignUpRoute } from "@/app/routes/sign-up";
import { SsoCallbackRoute } from "@/app/routes/sso-callback";
import { paths } from "@/config/paths";

const router = createBrowserRouter([
  { path: paths.root, element: <IndexRoute /> },
  { path: paths.signIn, element: <SignInRoute /> },
  { path: paths.signUp, element: <SignUpRoute /> },
  { path: paths.forgotPassword, element: <ForgotPasswordRoute /> },
  { path: paths.ssoCallback, element: <SsoCallbackRoute /> },
  { path: "*", element: <Navigate to="/sign-in" replace /> },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
