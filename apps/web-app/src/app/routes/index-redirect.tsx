import { Navigate } from "react-router";

import { paths } from "@/config/paths";

export function IndexRedirect(): React.ReactElement {
  return <Navigate replace to={paths.tripsNew} />;
}
