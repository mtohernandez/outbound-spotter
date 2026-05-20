import { vi, type Mock } from "vitest";

import type { SignInFutureResource, SignUpFutureResource } from "@clerk/shared/types";

// Hand-rolled factories that mimic the SignInFuture / SignUpFuture surface for Vitest tests.
// `@clerk/testing` v2.x only covers Cypress/Playwright integration, so the Vitest layer ships
// its own shims (recorded as a spec-02 decision in the PR body).

export interface MockSignIn {
  status: SignInFutureResource["status"];
  createdSessionId: string | null;
  password: Mock;
  sso: Mock;
  create: Mock;
  finalize: Mock;
  resetPasswordEmailCode: {
    sendCode: Mock;
    verifyCode: Mock;
    submitPassword: Mock;
  };
}

export interface MockSignUp {
  status: SignUpFutureResource["status"];
  createdSessionId: string | null;
  password: Mock;
  sso: Mock;
  finalize: Mock;
  verifications: {
    sendEmailCode: Mock;
    verifyEmailCode: Mock;
  };
}

const ok = () => Promise.resolve({ error: null });

export function buildSignInResource(overrides: Partial<MockSignIn> = {}): MockSignIn {
  return {
    status: "complete",
    createdSessionId: "sess_mock",
    password: vi.fn(ok),
    sso: vi.fn(ok),
    create: vi.fn(ok),
    finalize: vi.fn(ok),
    resetPasswordEmailCode: {
      sendCode: vi.fn(ok),
      verifyCode: vi.fn(ok),
      submitPassword: vi.fn(ok),
    },
    ...overrides,
  };
}

export function buildSignUpResource(overrides: Partial<MockSignUp> = {}): MockSignUp {
  return {
    status: "complete",
    createdSessionId: "sess_mock",
    password: vi.fn(ok),
    sso: vi.fn(ok),
    finalize: vi.fn(ok),
    verifications: {
      sendEmailCode: vi.fn(ok),
      verifyEmailCode: vi.fn(ok),
    },
    ...overrides,
  };
}

// Forced cast helper — the mocks satisfy the methods we touch; the rest of the resource is unused.
export function asSignIn(mock: MockSignIn): SignInFutureResource {
  return mock as unknown as SignInFutureResource;
}
export function asSignUp(mock: MockSignUp): SignUpFutureResource {
  return mock as unknown as SignUpFutureResource;
}
