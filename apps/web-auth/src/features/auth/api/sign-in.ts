import { extractClerkErrors } from "../utils/clerk-error";

import type { ClerkAPIError, SignInResource } from "@clerk/shared/types";

export type SignInResult =
  | { status: "complete"; createdSessionId: string }
  | { status: "needs_factor"; nextFactor: string }
  | { status: "error"; errors: ClerkAPIError[] };

export async function signInWithPassword(
  signIn: SignInResource,
  args: { identifier: string; password: string },
): Promise<SignInResult> {
  try {
    const result = await signIn.create({
      identifier: args.identifier,
      password: args.password,
    });
    if (result.status === "complete" && result.createdSessionId) {
      return { status: "complete", createdSessionId: result.createdSessionId };
    }
    return { status: "needs_factor", nextFactor: result.status ?? "unknown" };
  } catch (error) {
    return { status: "error", errors: extractClerkErrors(error) };
  }
}

export async function startGoogleOAuth(
  signIn: SignInResource,
  args: { redirectUrl: string; redirectUrlComplete: string },
): Promise<void> {
  await signIn.authenticateWithRedirect({
    strategy: "oauth_google",
    redirectUrl: args.redirectUrl,
    redirectUrlComplete: args.redirectUrlComplete,
  });
}
