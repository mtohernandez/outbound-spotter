import { SignIn } from "@clerk/react";

import { paths } from "@/config/paths";

export function SignInRoute(): React.ReactElement {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <SignIn routing="path" path={paths.signIn} signUpUrl={paths.signUp} />
    </main>
  );
}
