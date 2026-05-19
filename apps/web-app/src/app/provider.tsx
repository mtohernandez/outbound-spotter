import { ClerkProvider } from "@clerk/react";
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
    <ClerkProvider
      publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl={env.VITE_AUTH_SIGN_IN_URL}
      signInUrl={env.VITE_AUTH_SIGN_IN_URL}
      signUpUrl={env.VITE_AUTH_SIGN_UP_URL}
    >
      <QueryClientProvider client={queryClient}>
        {/* TODO(ui): swap fallback to <SpotterLoader /> once the loader component lands */}
        <Suspense fallback={null}>{children}</Suspense>
        <Toaster position="bottom-right" richColors closeButton />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
