import { describe, expect, it } from "vitest";

import { asSignUp, buildSignUpResource } from "@/testing/clerk-mocks";

import {
  resendVerificationCode,
  startSignUp,
  startSignUpGoogleOAuth,
  verifySignUpCode,
} from "./sign-up";

describe("startSignUp", () => {
  it("calls password and then ships an email code when verification is needed", async () => {
    const mock = buildSignUpResource({
      status: "missing_requirements",
      createdSessionId: null,
    });

    const result = await startSignUp(asSignUp(mock), {
      emailAddress: "a@b.co",
      password: "Strong-9!",
    });

    expect(mock.password).toHaveBeenCalledWith({
      emailAddress: "a@b.co",
      password: "Strong-9!",
    });
    expect(mock.verifications.sendEmailCode).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "needs_verification", emailAddress: "a@b.co" });
  });

  it("returns complete without sending an email code when Clerk activates immediately", async () => {
    const mock = buildSignUpResource({ status: "complete", createdSessionId: "sess_1" });

    const result = await startSignUp(asSignUp(mock), {
      emailAddress: "a@b.co",
      password: "Strong-9!",
    });

    expect(mock.verifications.sendEmailCode).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "complete", createdSessionId: "sess_1" });
  });

  it("surfaces a ClerkError from signUp.password", async () => {
    const error = { code: "form_password_pwned", message: "compromised" };
    const mock = buildSignUpResource();
    mock.password.mockResolvedValueOnce({ error });

    const result = await startSignUp(asSignUp(mock), {
      emailAddress: "a@b.co",
      password: "Strong-9!",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors[0]).toBe(error);
    }
  });
});

describe("verifySignUpCode", () => {
  it("returns complete after a successful verification", async () => {
    const mock = buildSignUpResource({ status: "complete", createdSessionId: "sess_2" });

    const result = await verifySignUpCode(asSignUp(mock), { code: "123456" });

    expect(mock.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
    expect(result).toEqual({ status: "complete", createdSessionId: "sess_2" });
  });

  it("returns incomplete when status is not complete after verifyEmailCode", async () => {
    const mock = buildSignUpResource({
      status: "missing_requirements",
      createdSessionId: null,
    });

    const result = await verifySignUpCode(asSignUp(mock), { code: "123456" });

    expect(result).toEqual({ status: "incomplete" });
  });

  it("surfaces a ClerkError from verifyEmailCode", async () => {
    const error = { code: "verification_failed", message: "bad code" };
    const mock = buildSignUpResource();
    mock.verifications.verifyEmailCode.mockResolvedValueOnce({ error });

    const result = await verifySignUpCode(asSignUp(mock), { code: "000000" });

    expect(result.status).toBe("error");
  });
});

describe("resendVerificationCode", () => {
  it("calls signUp.verifications.sendEmailCode", async () => {
    const mock = buildSignUpResource();
    await resendVerificationCode(asSignUp(mock));
    expect(mock.verifications.sendEmailCode).toHaveBeenCalledOnce();
  });
});

describe("startSignUpGoogleOAuth", () => {
  it("forwards the strategy + redirect URLs to signUp.sso", async () => {
    const mock = buildSignUpResource();

    await startSignUpGoogleOAuth(asSignUp(mock), {
      redirectUrl: "https://app.example.com",
      redirectCallbackUrl: "/sso-callback",
    });

    expect(mock.sso).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "https://app.example.com",
      redirectCallbackUrl: "/sso-callback",
    });
  });
});
