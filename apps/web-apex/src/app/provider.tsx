import { ClerkProvider } from "@clerk/react";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { Suspense } from "react";

import { env } from "@/config/env";

interface Props {
  readonly children: React.ReactNode;
}

export function AppProvider({ children }: Props): React.ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <ClerkProvider
        publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
        isSatellite
        domain={env.VITE_APEX_URL}
        signInUrl={env.VITE_AUTH_SIGN_IN_URL}
      >
        <Suspense
          fallback={
            <div className="bg-background flex min-h-dvh items-center justify-center">
              <SpotterLoader size="lg" />
            </div>
          }
        >
          {children}
        </Suspense>
      </ClerkProvider>
    </ThemeProvider>
  );
}
