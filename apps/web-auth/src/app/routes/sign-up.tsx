import { SignUp } from "@clerk/react";

import { paths } from "@/config/paths";

export function SignUpRoute(): React.ReactElement {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <SignUp routing="path" path={paths.signUp} signInUrl={paths.signIn} />
    </main>
  );
}
