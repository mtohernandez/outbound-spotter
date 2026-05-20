import { AuthLayout } from "@/features/auth/components/auth-layout";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export function ForgotPasswordRoute(): React.ReactElement {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
