import { describe, expect, it } from "vitest";

import { extractClerkErrors, splitClerkErrors } from "./clerk-error";

import type { AuthError } from "../types/flow-state";

describe("extractClerkErrors", () => {
  it("returns the errors array when the input matches the Clerk shape", () => {
    const errors = [{ code: "form_password_pwned", message: "compromised" }] as AuthError[];
    expect(extractClerkErrors({ errors })).toBe(errors);
  });

  it("returns an empty array for non-Clerk inputs", () => {
    expect(extractClerkErrors(new Error("network down"))).toEqual([]);
    expect(extractClerkErrors(null)).toEqual([]);
    expect(extractClerkErrors(undefined)).toEqual([]);
  });
});

describe("splitClerkErrors", () => {
  it("routes errors with a paramName to the field map and the rest to the banner", () => {
    const errors = [
      {
        code: "form_identifier_not_found",
        message: "no user",
        longMessage: "no user matches that identifier",
        meta: { paramName: "identifier" },
      },
      { code: "captcha_invalid", message: "captcha failed" },
    ] as AuthError[];

    const result = splitClerkErrors(errors);

    // Clerk's `identifier` param normalizes to our UX field `email` so the server error
    // lights up the email input rather than falling through to the banner.
    expect(result.field).toEqual({ email: "no user matches that identifier" });
    expect(result.banner).toHaveLength(1);
    expect(result.banner[0]?.code).toBe("captcha_invalid");
  });

  it("normalizes Clerk's email_address paramName to the email field key", () => {
    const errors = [
      {
        code: "form_param_format_invalid",
        message: "bad email",
        meta: { paramName: "email_address" },
      },
    ] as AuthError[];

    expect(splitClerkErrors(errors).field).toEqual({ email: "bad email" });
  });

  it("falls back to message when longMessage is missing", () => {
    const errors = [
      {
        code: "form_password_pwned",
        message: "compromised",
        meta: { paramName: "password" },
      },
    ] as AuthError[];

    expect(splitClerkErrors(errors).field.password).toBe("compromised");
  });
});
