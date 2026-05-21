import { useAuth } from "@clerk/react";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { type ReactNode, useEffect } from "react";

interface Props {
  readonly to: string;
  readonly children: ReactNode;
}

// Auth-route gate. Clerk hydrates asynchronously, so we show the loader while `isLoaded` is
// false to avoid a flash of the sign-in form for someone who already has a session. Once Clerk
// resolves, a signed-in visitor is hard-navigated to `to` (the web-app); a signed-out visitor
// gets to see the auth UI normally.
export function RedirectIfSignedIn({ to, children }: Props): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.location.replace(to);
    }
  }, [isLoaded, isSignedIn, to]);

  if (!isLoaded || isSignedIn) {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center">
        <SpotterLoader size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
