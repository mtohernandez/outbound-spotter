import { AuthLayout } from "@/features/auth/components/auth-layout";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export function SignUpRoute(): React.ReactElement {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
