import { env } from "@/config/env";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { RedirectIfSignedIn } from "@/features/auth/components/redirect-if-signed-in";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export function SignInRoute(): React.ReactElement {
  return (
    <RedirectIfSignedIn to={env.VITE_APP_URL}>
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
