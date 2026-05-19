import { AuthLayout } from "@/features/auth/components/auth-layout";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export function SignInRoute(): React.ReactElement {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}
