import { Navigate } from "react-router";

export function IndexRoute(): React.ReactElement {
  return <Navigate to="/sign-in" replace />;
}
