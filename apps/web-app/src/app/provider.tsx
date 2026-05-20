import { ClerkProvider } from "@clerk/react";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Toaster } from "sonner";

import { env } from "@/config/env";
import { queryClient } from "@/lib/query-client";

interface Props {
  readonly children: React.ReactNode;
}

export function AppProvider({ children }: Props): React.ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <ClerkProvider
        publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl={env.VITE_AUTH_SIGN_IN_URL}
        signInUrl={env.VITE_AUTH_SIGN_IN_URL}
        signUpUrl={env.VITE_AUTH_SIGN_UP_URL}
      >
        <QueryClientProvider client={queryClient}>
          <Suspense
            fallback={
              <div className="bg-background flex min-h-dvh items-center justify-center">
                <SpotterLoader size="lg" />
              </div>
            }
          >
            {children}
          </Suspense>
          <Toaster position="bottom-right" richColors closeButton />
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}
