import { env } from "@/config/env";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { RedirectIfSignedIn } from "@/features/auth/components/redirect-if-signed-in";

export function ForgotPasswordRoute(): React.ReactElement {
  return (
    <RedirectIfSignedIn to={env.VITE_APP_URL}>
      <AuthLayout>
        <ForgotPasswordForm />
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
