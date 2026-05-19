import { extractClerkErrors } from "../utils/clerk-error";

import type { ClerkAPIError, SignInResource } from "@clerk/shared/types";

export type StartResetResult =
  | { status: "needs_code"; emailAddress: string }
  | { status: "error"; errors: ClerkAPIError[] };

export type VerifyResetResult =
  | { status: "needs_password" }
  | { status: "error"; errors: ClerkAPIError[] };

export type CompleteResetResult =
  | { status: "complete"; createdSessionId: string }
  | { status: "needs_factor" }
  | { status: "error"; errors: ClerkAPIError[] };

const RESET_FACTOR = "reset_password_email_code" as const;

export async function startPasswordReset(
  signIn: SignInResource,
  args: { emailAddress: string },
): Promise<StartResetResult> {
  try {
    await signIn.create({
      strategy: RESET_FACTOR,
      identifier: args.emailAddress,
    });
    return { status: "needs_code", emailAddress: args.emailAddress };
  } catch (error) {
    return { status: "error", errors: extractClerkErrors(error) };
  }
}

export async function verifyResetCode(
  signIn: SignInResource,
  args: { code: string },
): Promise<VerifyResetResult> {
  try {
    await signIn.attemptFirstFactor({ strategy: RESET_FACTOR, code: args.code });
    return { status: "needs_password" };
  } catch (error) {
    return { status: "error", errors: extractClerkErrors(error) };
  }
}

export async function completePasswordReset(
  signIn: SignInResource,
  args: { password: string },
): Promise<CompleteResetResult> {
  try {
    const result = await signIn.resetPassword({
      password: args.password,
      signOutOfOtherSessions: true,
    });

    if (result.status === "complete" && result.createdSessionId) {
      return { status: "complete", createdSessionId: result.createdSessionId };
    }
    return { status: "needs_factor" };
  } catch (error) {
    return { status: "error", errors: extractClerkErrors(error) };
  }
}
