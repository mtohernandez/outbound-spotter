import { describe, expect, it } from "vitest";

import { extractClerkErrors, splitClerkErrors } from "./clerk-error";

import type { ClerkAPIError } from "@clerk/shared/types";

describe("extractClerkErrors", () => {
  it("returns the errors array when the input matches Clerk's error shape", () => {
    const errors = [{ code: "form_password_pwned", message: "compromised", meta: {} }];
    expect(extractClerkErrors({ errors })).toBe(errors);
  });

  it("returns an empty array when the input is not a Clerk error", () => {
    expect(extractClerkErrors(new Error("network down"))).toEqual([]);
    expect(extractClerkErrors(null)).toEqual([]);
    expect(extractClerkErrors(undefined)).toEqual([]);
  });
});

describe("splitClerkErrors", () => {
  it("routes errors with a paramName to the field map and the rest to the banner", () => {
    const errors: ClerkAPIError[] = [
      {
        code: "form_identifier_not_found",
        message: "no user",
        meta: { paramName: "identifier" },
        longMessage: "no user matches that identifier",
      },
      { code: "captcha_invalid", message: "captcha failed", meta: {} },
    ];

    const result = splitClerkErrors(errors);

    expect(result.field).toEqual({ identifier: "no user matches that identifier" });
    expect(result.banner).toHaveLength(1);
    expect(result.banner[0]?.code).toBe("captcha_invalid");
  });

  it("falls back to message when longMessage is missing", () => {
    const errors: ClerkAPIError[] = [
      {
        code: "form_password_pwned",
        message: "compromised",
        meta: { paramName: "password" },
      },
    ];

    expect(splitClerkErrors(errors).field.password).toBe("compromised");
  });
});
