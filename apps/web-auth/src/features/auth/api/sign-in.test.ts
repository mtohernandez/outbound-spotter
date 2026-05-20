import { describe, expect, it } from "vitest";

import { asSignIn, buildSignInResource } from "@/testing/clerk-mocks";

import { signInWithPassword, startGoogleOAuth } from "./sign-in";

describe("signInWithPassword", () => {
  it("returns complete with the session id when signIn.status resolves to complete", async () => {
    const mock = buildSignInResource({ status: "complete", createdSessionId: "sess_1" });

    const result = await signInWithPassword(asSignIn(mock), {
      identifier: "a@b.co",
      password: "pw",
    });

    expect(mock.password).toHaveBeenCalledWith({ identifier: "a@b.co", password: "pw" });
    expect(result).toEqual({ status: "complete", createdSessionId: "sess_1" });
  });

  it("returns needs_factor when signIn.status is not complete", async () => {
    const mock = buildSignInResource({
      status: "needs_second_factor",
      createdSessionId: null,
    });

    const result = await signInWithPassword(asSignIn(mock), {
      identifier: "a@b.co",
      password: "pw",
    });

    expect(result).toEqual({ status: "needs_factor", nextFactor: "needs_second_factor" });
  });

  it("returns error when signIn.password resolves with a ClerkError", async () => {
    const error = { code: "form_password_incorrect", message: "wrong password" };
    const mock = buildSignInResource();
    mock.password.mockResolvedValueOnce({ error });

    const result = await signInWithPassword(asSignIn(mock), {
      identifier: "a@b.co",
      password: "pw",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors[0]).toBe(error);
    }
  });
});

describe("startGoogleOAuth", () => {
  it("forwards the strategy and redirect URLs to signIn.sso", async () => {
    const mock = buildSignInResource();

    await startGoogleOAuth(asSignIn(mock), {
      redirectUrl: "https://app.example.com",
      redirectCallbackUrl: "/sso-callback",
    });

    expect(mock.sso).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "https://app.example.com",
      redirectCallbackUrl: "/sso-callback",
    });
  });

  it("returns the ClerkError when sso resolves with one", async () => {
    const error = { code: "oauth_canceled", message: "user cancelled" };
    const mock = buildSignInResource();
    mock.sso.mockResolvedValueOnce({ error });

    const result = await startGoogleOAuth(asSignIn(mock), {
      redirectUrl: "/x",
      redirectCallbackUrl: "/y",
    });

    expect(result).toBe(error);
  });
});
