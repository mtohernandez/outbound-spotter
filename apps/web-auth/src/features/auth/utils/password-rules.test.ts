import { describe, expect, it } from "vitest";

import {
  forgotPasswordResetSchema,
  scorePassword,
  signInSchema,
  signUpSchema,
} from "./password-rules";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    expect(signInSchema.safeParse({ email: "driver@example.com", password: "any" }).success).toBe(
      true,
    );
  });

  it("rejects an empty password", () => {
    expect(signInSchema.safeParse({ email: "driver@example.com", password: "" }).success).toBe(
      false,
    );
  });
});

describe("signUpSchema", () => {
  it("requires complexity", () => {
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "weakpass" }).success).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "Strong-Pass-9" }).success).toBe(
      true,
    );
  });
});

describe("forgotPasswordResetSchema", () => {
  it("requires matching confirm field", () => {
    const result = forgotPasswordResetSchema.safeParse({
      password: "NewPassword1",
      confirmPassword: "NewPassword2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });
});

describe("scorePassword", () => {
  it("scores a common password low", async () => {
    const result = await scorePassword("password");
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("scores a long random password high", async () => {
    const result = await scorePassword("L8!#qfPo-2VsW#tr%3");
    expect(result.score).toBeGreaterThanOrEqual(3);
  });
});
