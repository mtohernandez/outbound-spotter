import type { AuthError } from "../types/flow-state";
import type { SignUpFutureResource } from "@clerk/shared/types";

// SignUp Future API: signUp.password({ emailAddress, password }) creates the sign-up; if status
// becomes `missing_requirements` with email unverified, signUp.verifications.sendEmailCode() ships
// the OTP; signUp.verifications.verifyEmailCode({ code }) attempts; signUp.finalize() activates.
// Reference: https://clerk.com/docs/guides/development/custom-flows/authentication/email-password

export type StartSignUpResult =
  | { status: "needs_verification"; emailAddress: string }
  | { status: "complete"; createdSessionId: string }
  | { status: "error"; errors: AuthError[] };

export type VerifySignUpResult =
  | { status: "complete"; createdSessionId: string }
  | { status: "incomplete" }
  | { status: "error"; errors: AuthError[] };

export async function startSignUp(
  signUp: SignUpFutureResource,
  args: { emailAddress: string; password: string },
): Promise<StartSignUpResult> {
  const passwordResult = await signUp.password({
    emailAddress: args.emailAddress,
    password: args.password,
  });
  if (passwordResult.error) return { status: "error", errors: [passwordResult.error] };

  if (signUp.status === "complete" && signUp.createdSessionId) {
    return { status: "complete", createdSessionId: signUp.createdSessionId };
  }

  const sendResult = await signUp.verifications.sendEmailCode();
  if (sendResult.error) return { status: "error", errors: [sendResult.error] };

  return { status: "needs_verification", emailAddress: args.emailAddress };
}

export async function resendVerificationCode(
  signUp: SignUpFutureResource,
): Promise<AuthError | null> {
  const { error } = await signUp.verifications.sendEmailCode();
  return error;
}

export async function verifySignUpCode(
  signUp: SignUpFutureResource,
  args: { code: string },
): Promise<VerifySignUpResult> {
  const { error } = await signUp.verifications.verifyEmailCode({ code: args.code });
  if (error) return { status: "error", errors: [error] };
  if (signUp.status === "complete" && signUp.createdSessionId) {
    return { status: "complete", createdSessionId: signUp.createdSessionId };
  }
  return { status: "incomplete" };
}

export async function finalizeSignUp(signUp: SignUpFutureResource): Promise<AuthError | null> {
  const { error } = await signUp.finalize();
  return error;
}

export async function startSignUpGoogleOAuth(
  signUp: SignUpFutureResource,
  args: { redirectUrl: string; redirectCallbackUrl: string },
): Promise<AuthError | null> {
  const { error } = await signUp.sso({
    strategy: "oauth_google",
    redirectUrl: args.redirectUrl,
    redirectCallbackUrl: args.redirectCallbackUrl,
  });
  return error;
}
