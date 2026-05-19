import { describe, expect, it, vi } from "vitest";

import { signInWithPassword, startGoogleOAuth } from "./sign-in";

import type { SignInResource } from "@clerk/shared/types";

function makeSignInResource(overrides: Partial<SignInResource> = {}): SignInResource {
  return {
    create: vi.fn(),
    authenticateWithRedirect: vi.fn(),
    ...overrides,
  } as unknown as SignInResource;
}

describe("signInWithPassword", () => {
  it("returns complete with the created session id on success", async () => {
    const signIn = makeSignInResource({
      create: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_1" }),
    });

    const result = await signInWithPassword(signIn, {
      identifier: "a@b.co",
      password: "pw",
    });

    expect(result).toEqual({ status: "complete", createdSessionId: "sess_1" });
  });

  it("returns needs_factor when Clerk reports an intermediate status", async () => {
    const signIn = makeSignInResource({
      create: vi.fn().mockResolvedValue({ status: "needs_second_factor", createdSessionId: null }),
    });

    const result = await signInWithPassword(signIn, {
      identifier: "a@b.co",
      password: "pw",
    });

    expect(result).toEqual({ status: "needs_factor", nextFactor: "needs_second_factor" });
  });

  it("maps a thrown Clerk error into a typed result", async () => {
    const errors = [{ code: "form_password_incorrect", message: "wrong password", meta: {} }];
    const signIn = makeSignInResource({
      create: vi.fn().mockRejectedValue({ errors }),
    });

    const result = await signInWithPassword(signIn, {
      identifier: "a@b.co",
      password: "pw",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors).toBe(errors);
    }
  });
});

describe("startGoogleOAuth", () => {
  it("forwards the strategy + redirect URLs to authenticateWithRedirect", async () => {
    const signIn = makeSignInResource();

    await startGoogleOAuth(signIn, {
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "https://app.example.com",
    });

    expect(signIn.authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "https://app.example.com",
    });
  });
});
