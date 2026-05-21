import { ClerkProvider, useUser } from "@clerk/react";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { Toaster } from "@outbound/ui/components/ui/sonner";
import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";

import { AppErrorBoundary } from "@/components/error-boundary/app-error-boundary";
import { env } from "@/config/env";
import { queryClient } from "@/lib/query-client";

interface Props {
  readonly children: React.ReactNode;
}

const ANONYMOUS_THEME_KEY = "outbound-theme:anonymous";

// Inner provider that reads the Clerk user identity and re-keys ThemeProvider
// so per-user theme preferences do not leak across accounts on a shared
// kiosk (spec 11b Decision 13). When Clerk hasn't loaded yet we fall back to
// the anonymous key. We `key={storageKey}` so a sign-in transition remounts
// the provider with the user-specific localStorage namespace; this is
// preferable to a setState-in-effect rehydrate (rejected by react-hooks/
// set-state-in-effect) and one short flash is acceptable on sign-in.
function ThemedTree({ children }: Props): React.ReactElement {
  const { user, isLoaded } = useUser();
  const storageKey = isLoaded && user ? `outbound-theme:${user.id}` : ANONYMOUS_THEME_KEY;
  return (
    <ThemeProvider key={storageKey} defaultTheme="system" storageKey={storageKey}>
      {children}
    </ThemeProvider>
  );
}

export function AppProvider({ children }: Props): React.ReactElement {
  return (
    <ClerkProvider
      publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl={env.VITE_AUTH_SIGN_IN_URL}
      signInUrl={env.VITE_AUTH_SIGN_IN_URL}
      signUpUrl={env.VITE_AUTH_SIGN_UP_URL}
      isSatellite
      domain={new URL(env.VITE_APP_URL).host}
    >
      <QueryClientProvider client={queryClient}>
        <ThemedTree>
          <TooltipProvider delayDuration={200}>
            <AppErrorBoundary>
              <Suspense
                fallback={
                  <div className="bg-background flex min-h-dvh items-center justify-center">
                    <SpotterLoader size="lg" />
                  </div>
                }
              >
                {children}
              </Suspense>
            </AppErrorBoundary>
          </TooltipProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemedTree>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
