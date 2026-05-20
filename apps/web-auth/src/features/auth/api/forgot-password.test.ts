import { describe, expect, it } from "vitest";

import { asSignIn, buildSignInResource } from "@/testing/clerk-mocks";

import { completePasswordReset, startPasswordReset, verifyResetCode } from "./forgot-password";

describe("startPasswordReset", () => {
  it("seeds the identifier via create and sends the reset code", async () => {
    const mock = buildSignInResource();

    const result = await startPasswordReset(asSignIn(mock), { emailAddress: "a@b.co" });

    expect(mock.create).toHaveBeenCalledWith({ identifier: "a@b.co" });
    expect(mock.resetPasswordEmailCode.sendCode).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "needs_code", emailAddress: "a@b.co" });
  });

  it("surfaces a ClerkError when sendCode fails", async () => {
    const error = { code: "form_identifier_not_found", message: "no user" };
    const mock = buildSignInResource();
    mock.resetPasswordEmailCode.sendCode.mockResolvedValueOnce({ error });

    const result = await startPasswordReset(asSignIn(mock), { emailAddress: "missing@b.co" });

    expect(result.status).toBe("error");
  });
});

describe("verifyResetCode", () => {
  it("calls verifyCode and returns needs_password on success", async () => {
    const mock = buildSignInResource();

    const result = await verifyResetCode(asSignIn(mock), { code: "654321" });

    expect(mock.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({ code: "654321" });
    expect(result).toEqual({ status: "needs_password" });
  });

  it("surfaces a ClerkError from verifyCode", async () => {
    const error = { code: "verification_failed", message: "bad code" };
    const mock = buildSignInResource();
    mock.resetPasswordEmailCode.verifyCode.mockResolvedValueOnce({ error });

    const result = await verifyResetCode(asSignIn(mock), { code: "000000" });

    expect(result.status).toBe("error");
  });
});

describe("completePasswordReset", () => {
  it("submits the new password and returns complete with the session id", async () => {
    const mock = buildSignInResource({ status: "complete", createdSessionId: "sess_3" });

    const result = await completePasswordReset(asSignIn(mock), {
      password: "NewStrong-Pass-1",
    });

    expect(mock.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
      password: "NewStrong-Pass-1",
      signOutOfOtherSessions: true,
    });
    expect(result).toEqual({ status: "complete", createdSessionId: "sess_3" });
  });

  it("returns needs_factor when status is not complete after submit", async () => {
    const mock = buildSignInResource({
      status: "needs_second_factor",
      createdSessionId: null,
    });

    const result = await completePasswordReset(asSignIn(mock), {
      password: "NewStrong-Pass-1",
    });

    expect(result).toEqual({ status: "needs_factor" });
  });
});
