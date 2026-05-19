import { vi, type Mock } from "vitest";

import type { SignInResource, SignUpResource } from "@clerk/shared/types";

// Hand-rolled factories that build a SignIn/SignUp resource scaffold with vi-mocked methods.
// `@clerk/testing` v2.x ships Cypress/Playwright helpers only — it does not cover Vitest mocks,
// so the unit/integration layer hand-rolls these shims (recorded as the C5 decision in the PR body).

export interface MockSignIn extends SignInResource {
  create: Mock;
  authenticateWithRedirect: Mock;
  attemptFirstFactor: Mock;
  resetPassword: Mock;
}

export interface MockSignUp extends SignUpResource {
  create: Mock;
  prepareEmailAddressVerification: Mock;
  attemptEmailAddressVerification: Mock;
  authenticateWithRedirect: Mock;
}

export function buildSignInResource(overrides: Partial<MockSignIn> = {}): MockSignIn {
  return {
    create: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_mock" }),
    authenticateWithRedirect: vi.fn().mockResolvedValue(undefined),
    attemptFirstFactor: vi.fn().mockResolvedValue({}),
    resetPassword: vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_mock" }),
    ...overrides,
  } as unknown as MockSignIn;
}

export function buildSignUpResource(overrides: Partial<MockSignUp> = {}): MockSignUp {
  return {
    create: vi.fn().mockResolvedValue({ status: "missing_requirements", createdSessionId: null }),
    prepareEmailAddressVerification: vi.fn().mockResolvedValue(undefined),
    attemptEmailAddressVerification: vi
      .fn()
      .mockResolvedValue({ status: "complete", createdSessionId: "sess_mock" }),
    authenticateWithRedirect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as MockSignUp;
}

export function buildSetActive(): Mock {
  return vi.fn().mockResolvedValue(undefined);
}
