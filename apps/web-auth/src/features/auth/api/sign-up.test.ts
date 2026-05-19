import { describe, expect, it, vi } from "vitest";

import {
  resendVerificationCode,
  startSignUp,
  startSignUpGoogleOAuth,
  verifySignUpCode,
} from "./sign-up";

import type { SignUpResource } from "@clerk/shared/types";

function makeSignUpResource(overrides: Partial<SignUpResource> = {}): SignUpResource {
  return {
    create: vi.fn(),
    prepareEmailAddressVerification: vi.fn(),
    attemptEmailAddressVerification: vi.fn(),
    authenticateWithRedirect: vi.fn(),
    ...overrides,
  } as unknown as SignUpResource;
}

describe("startSignUp", () => {
  it("requests an email_code verification after a successful create", async () => {
    const prepare = vi.fn().mockResolvedValue({});
    const signUp = makeSignUpResource({
      create: vi.fn().mockResolvedValue({ status: "missing_requirements", createdSessionId: null }),
      prepareEmailAddressVerification: prepare,
    });

    const result = await startSignUp(signUp, { emailAddress: "a@b.co", password: "Strong-9!" });

    expect(prepare).toHaveBeenCalledWith({ strategy: "email_code" });
    expect(result).toEqual({ status: "needs_verification", emailAddress: "a@b.co" });
  });

  it("returns complete when Clerk reports an immediate session", async () => {
    const signUp = makeSignUpResource({
      create: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_1" }),
    });

    const result = await startSignUp(signUp, { emailAddress: "a@b.co", password: "Strong-9!" });

    expect(result).toEqual({ status: "complete", createdSessionId: "sess_1" });
  });

  it("returns the Clerk error envelope on rejected create", async () => {
    const errors = [{ code: "form_password_pwned", message: "compromised", meta: {} }];
    const signUp = makeSignUpResource({
      create: vi.fn().mockRejectedValue({ errors }),
    });

    const result = await startSignUp(signUp, { emailAddress: "a@b.co", password: "Strong-9!" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors).toBe(errors);
    }
  });
});

describe("verifySignUpCode", () => {
  it("returns complete when the attempted verification succeeds", async () => {
    const signUp = makeSignUpResource({
      attemptEmailAddressVerification: vi
        .fn()
        .mockResolvedValue({ status: "complete", createdSessionId: "sess_2" }),
    });

    const result = await verifySignUpCode(signUp, { code: "123456" });

    expect(result).toEqual({ status: "complete", createdSessionId: "sess_2" });
  });

  it("returns incomplete when Clerk reports a non-complete status", async () => {
    const signUp = makeSignUpResource({
      attemptEmailAddressVerification: vi
        .fn()
        .mockResolvedValue({ status: "missing_requirements", createdSessionId: null }),
    });

    const result = await verifySignUpCode(signUp, { code: "123456" });

    expect(result).toEqual({ status: "incomplete" });
  });

  it("surfaces Clerk errors", async () => {
    const errors = [{ code: "verification_failed", message: "bad code", meta: {} }];
    const signUp = makeSignUpResource({
      attemptEmailAddressVerification: vi.fn().mockRejectedValue({ errors }),
    });

    const result = await verifySignUpCode(signUp, { code: "000000" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors).toBe(errors);
    }
  });
});

describe("resendVerificationCode", () => {
  it("re-prepares the email_code verification", async () => {
    const signUp = makeSignUpResource();
    await resendVerificationCode(signUp);
    expect(signUp.prepareEmailAddressVerification).toHaveBeenCalledWith({ strategy: "email_code" });
  });
});

describe("startSignUpGoogleOAuth", () => {
  it("forwards the strategy + redirect URLs", async () => {
    const signUp = makeSignUpResource();

    await startSignUpGoogleOAuth(signUp, {
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "https://app.example.com",
    });

    expect(signUp.authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "https://app.example.com",
    });
  });
});
