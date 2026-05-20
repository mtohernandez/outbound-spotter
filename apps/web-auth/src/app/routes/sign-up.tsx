import { env } from "@/config/env";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { RedirectIfSignedIn } from "@/features/auth/components/redirect-if-signed-in";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export function SignUpRoute(): React.ReactElement {
  return (
    <RedirectIfSignedIn to={env.VITE_APP_URL}>
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
