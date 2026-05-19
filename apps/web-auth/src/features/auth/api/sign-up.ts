import { extractClerkErrors } from "../utils/clerk-error";

import type { ClerkAPIError, SignUpResource } from "@clerk/shared/types";

export type StartSignUpResult =
  | { status: "needs_verification"; emailAddress: string }
  | { status: "complete"; createdSessionId: string }
  | { status: "error"; errors: ClerkAPIError[] };

export type VerifySignUpResult =
  | { status: "complete"; createdSessionId: string }
  | { status: "incomplete" }
  | { status: "error"; errors: ClerkAPIError[] };

export async function startSignUp(
  signUp: SignUpResource,
  args: { emailAddress: string; password: string },
): Promise<StartSignUpResult> {
  try {
    const created = await signUp.create({
      emailAddress: args.emailAddress,
      password: args.password,
    });

    if (created.status === "complete" && created.createdSessionId) {
      return { status: "complete", createdSessionId: created.createdSessionId };
    }

    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    return { status: "needs_verification", emailAddress: args.emailAddress };
  } catch (error) {
    return { status: "error", errors: extractClerkErrors(error) };
  }
}

export async function resendVerificationCode(signUp: SignUpResource): Promise<void> {
  await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
}

export async function verifySignUpCode(
  signUp: SignUpResource,
  args: { code: string },
): Promise<VerifySignUpResult> {
  try {
    const attempted = await signUp.attemptEmailAddressVerification({ code: args.code });
    if (attempted.status === "complete" && attempted.createdSessionId) {
      return { status: "complete", createdSessionId: attempted.createdSessionId };
    }
    return { status: "incomplete" };
  } catch (error) {
    return { status: "error", errors: extractClerkErrors(error) };
  }
}

export async function startSignUpGoogleOAuth(
  signUp: SignUpResource,
  args: { redirectUrl: string; redirectUrlComplete: string },
): Promise<void> {
  await signUp.authenticateWithRedirect({
    strategy: "oauth_google",
    redirectUrl: args.redirectUrl,
    redirectUrlComplete: args.redirectUrlComplete,
  });
}
