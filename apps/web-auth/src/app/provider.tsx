import { ClerkProvider } from "@clerk/react";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { Toaster } from "@outbound/ui/components/ui/sonner";
import { Suspense } from "react";

import { AppErrorBoundary } from "@/components/error-boundary/app-error-boundary";
import { env } from "@/config/env";

interface Props {
  readonly children: React.ReactNode;
}

export function AppProvider({ children }: Props): React.ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <ClerkProvider
        publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
        signInFallbackRedirectUrl={env.VITE_APP_URL}
        signUpFallbackRedirectUrl={env.VITE_APP_URL}
        afterSignOutUrl={env.VITE_APP_URL}
      >
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
        <Toaster position="bottom-right" richColors closeButton />
      </ClerkProvider>
    </ThemeProvider>
  );
}
