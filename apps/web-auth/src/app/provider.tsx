import { ClerkProvider } from "@clerk/react";
import { Suspense } from "react";

import { env } from "@/config/env";

interface Props {
  readonly children: React.ReactNode;
}

export function AppProvider({ children }: Props): React.ReactElement {
  return (
    <ClerkProvider
      publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl={env.VITE_APP_URL}
      signUpFallbackRedirectUrl={env.VITE_APP_URL}
      afterSignOutUrl={env.VITE_APP_URL}
    >
      {/* TODO(ui): swap fallback to <SpotterLoader /> once the loader component lands */}
      <Suspense fallback={null}>{children}</Suspense>
    </ClerkProvider>
  );
}
