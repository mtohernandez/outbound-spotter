import { ClerkLoaded, RedirectToSignIn, Show } from "@clerk/react";

import type { ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

export function RequireAuth({ children }: Props): React.ReactElement {
  return (
    <ClerkLoaded>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </ClerkLoaded>
  );
}
