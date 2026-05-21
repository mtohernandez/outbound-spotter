import type { AuthError } from "../types/flow-state";
import type { SignInFutureResource } from "@clerk/shared/types";

// Reference: https://clerk.com/docs/guides/development/custom-flows/account-updates/forgot-password

export type StartResetResult =
  | { status: "needs_code"; emailAddress: string }
  | { status: "error"; errors: AuthError[] };

export type VerifyResetResult =
  | { status: "needs_password" }
  | { status: "error"; errors: AuthError[] };

export type CompleteResetResult =
  | { status: "complete"; createdSessionId: string }
  | { status: "needs_factor" }
  | { status: "error"; errors: AuthError[] };

export async function startPasswordReset(
  signIn: SignInFutureResource,
  args: { emailAddress: string },
): Promise<StartResetResult> {
  const createResult = await signIn.create({ identifier: args.emailAddress });
  if (createResult.error) return { status: "error", errors: [createResult.error] };

  const sendResult = await signIn.resetPasswordEmailCode.sendCode();
  if (sendResult.error) return { status: "error", errors: [sendResult.error] };
  return { status: "needs_code", emailAddress: args.emailAddress };
}

export async function verifyResetCode(
  signIn: SignInFutureResource,
  args: { code: string },
): Promise<VerifyResetResult> {
  const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: args.code });
  if (error) return { status: "error", errors: [error] };
  return { status: "needs_password" };
}

// Resending must NOT re-seed the sign-in flow via `signIn.create`, because the active flow is
// already past the identifier step. Future API exposes a dedicated `sendCode()` for that.
export async function resendPasswordResetCode(
  signIn: SignInFutureResource,
): Promise<AuthError | null> {
  const { error } = await signIn.resetPasswordEmailCode.sendCode();
  return error;
}

export async function completePasswordReset(
  signIn: SignInFutureResource,
  args: { password: string },
): Promise<CompleteResetResult> {
  const submitResult = await signIn.resetPasswordEmailCode.submitPassword({
    password: args.password,
    signOutOfOtherSessions: true,
  });
  if (submitResult.error) return { status: "error", errors: [submitResult.error] };

  if (signIn.status === "complete" && signIn.createdSessionId) {
    return { status: "complete", createdSessionId: signIn.createdSessionId };
  }
  return { status: "needs_factor" };
}
