import { useAuth } from "@clerk/react";
import { type ReactNode, useEffect } from "react";

import { env } from "@/config/env";

interface Props {
  readonly children: ReactNode;
}

export function RequireAuth({ children }: Props): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      window.location.replace(env.VITE_AUTH_SIGN_IN_URL);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return <>{children}</>;
}
