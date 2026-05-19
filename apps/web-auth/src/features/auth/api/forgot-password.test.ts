import { describe, expect, it, vi } from "vitest";

import { completePasswordReset, startPasswordReset, verifyResetCode } from "./forgot-password";

import type { SignInResource } from "@clerk/shared/types";

function makeSignInResource(overrides: Partial<SignInResource> = {}): SignInResource {
  return {
    create: vi.fn(),
    attemptFirstFactor: vi.fn(),
    resetPassword: vi.fn(),
    ...overrides,
  } as unknown as SignInResource;
}

describe("startPasswordReset", () => {
  it("calls signIn.create with the reset strategy and returns needs_code", async () => {
    const signIn = makeSignInResource({
      create: vi.fn().mockResolvedValue({}),
    });

    const result = await startPasswordReset(signIn, { emailAddress: "a@b.co" });

    expect(signIn.create).toHaveBeenCalledWith({
      strategy: "reset_password_email_code",
      identifier: "a@b.co",
    });
    expect(result).toEqual({ status: "needs_code", emailAddress: "a@b.co" });
  });

  it("maps Clerk errors to the typed envelope", async () => {
    const errors = [{ code: "form_identifier_not_found", message: "no user", meta: {} }];
    const signIn = makeSignInResource({
      create: vi.fn().mockRejectedValue({ errors }),
    });

    const result = await startPasswordReset(signIn, { emailAddress: "missing@b.co" });

    expect(result.status).toBe("error");
  });
});

describe("verifyResetCode", () => {
  it("attempts the reset factor and returns needs_password", async () => {
    const signIn = makeSignInResource({
      attemptFirstFactor: vi.fn().mockResolvedValue({}),
    });

    const result = await verifyResetCode(signIn, { code: "654321" });

    expect(signIn.attemptFirstFactor).toHaveBeenCalledWith({
      strategy: "reset_password_email_code",
      code: "654321",
    });
    expect(result).toEqual({ status: "needs_password" });
  });

  it("surfaces an invalid-code error", async () => {
    const errors = [{ code: "verification_failed", message: "bad code", meta: {} }];
    const signIn = makeSignInResource({
      attemptFirstFactor: vi.fn().mockRejectedValue({ errors }),
    });

    const result = await verifyResetCode(signIn, { code: "000000" });

    expect(result.status).toBe("error");
  });
});

describe("completePasswordReset", () => {
  it("resets the password and returns complete with the created session id", async () => {
    const signIn = makeSignInResource({
      resetPassword: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_3" }),
    });

    const result = await completePasswordReset(signIn, { password: "NewStrong-Pass-1" });

    expect(signIn.resetPassword).toHaveBeenCalledWith({
      password: "NewStrong-Pass-1",
      signOutOfOtherSessions: true,
    });
    expect(result).toEqual({ status: "complete", createdSessionId: "sess_3" });
  });

  it("returns needs_factor when the reset is incomplete", async () => {
    const signIn = makeSignInResource({
      resetPassword: vi
        .fn()
        .mockResolvedValue({ status: "needs_second_factor", createdSessionId: null }),
    });

    const result = await completePasswordReset(signIn, { password: "NewStrong-Pass-1" });

    expect(result).toEqual({ status: "needs_factor" });
  });
});
