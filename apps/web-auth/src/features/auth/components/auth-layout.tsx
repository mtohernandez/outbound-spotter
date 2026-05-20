import { AuthFooter } from "./auth-footer";
import { AuthVideoPanel } from "./auth-video-panel";

import type { ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: Props): React.ReactElement {
  return (
    <div className="bg-background text-foreground relative min-h-dvh">
      <a
        href="#auth-main"
        className="bg-primary text-primary-foreground ring-ring ring-offset-background sr-only rounded-md px-3 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="flex min-h-dvh flex-col gap-6 p-6 lg:gap-8 lg:p-8">
        <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          <AuthVideoPanel />
          <main id="auth-main" className="flex flex-col">
            {children}
          </main>
        </div>
        <AuthFooter />
      </div>
    </div>
  );
}
