import { AuthenticateWithRedirectCallback } from "@clerk/react";

import { env } from "@/config/env";

export function SsoCallbackRoute(): React.ReactElement {
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={env.VITE_APP_URL}
      signUpForceRedirectUrl={env.VITE_APP_URL}
    />
  );
}
