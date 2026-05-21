import { useAuth } from "@clerk/react";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { useEffect, useRef } from "react";

import { env } from "@/config/env";

export function Redirector(): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || navigatedRef.current) return;
    navigatedRef.current = true;
    const target = isSignedIn ? env.VITE_APP_URL : env.VITE_AUTH_SIGN_IN_URL;
    window.location.replace(target);
  }, [isLoaded, isSignedIn]);

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center">
      <SpotterLoader size="lg" />
    </div>
  );
}
