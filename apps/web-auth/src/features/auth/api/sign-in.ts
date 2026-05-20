import type { AuthError } from "../types/flow-state";
import type { SignInFutureResource } from "@clerk/shared/types";

// Reference: https://clerk.com/docs/guides/development/custom-flows/authentication/email-password

export type SignInResult =
  | { status: "complete"; createdSessionId: string }
  | { status: "needs_factor"; nextFactor: string }
  | { status: "error"; errors: AuthError[] };

export async function signInWithPassword(
  signIn: SignInFutureResource,
  args: { identifier: string; password: string },
): Promise<SignInResult> {
  const { error } = await signIn.password({
    identifier: args.identifier,
    password: args.password,
  });
  if (error) return { status: "error", errors: [error] };
  if (signIn.status === "complete" && signIn.createdSessionId) {
    return { status: "complete", createdSessionId: signIn.createdSessionId };
  }
  return { status: "needs_factor", nextFactor: signIn.status };
}

export async function finalizeSignIn(signIn: SignInFutureResource): Promise<AuthError | null> {
  const { error } = await signIn.finalize();
  return error;
}

export async function startGoogleOAuth(
  signIn: SignInFutureResource,
  args: { redirectUrl: string; redirectCallbackUrl: string },
): Promise<AuthError | null> {
  const { error } = await signIn.sso({
    strategy: "oauth_google",
    redirectUrl: args.redirectUrl,
    redirectCallbackUrl: args.redirectCallbackUrl,
  });
  return error;
}
