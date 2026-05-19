import { AuthenticateWithRedirectCallback } from "@clerk/react";

export function SsoCallbackRoute(): React.ReactElement {
  return <AuthenticateWithRedirectCallback />;
}
