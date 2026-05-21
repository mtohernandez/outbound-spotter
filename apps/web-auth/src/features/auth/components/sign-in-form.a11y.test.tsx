import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildSignInResource, type MockSignIn } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

import { SignInForm } from "./sign-in-form";

let mockSignIn: MockSignIn;

vi.mock("@clerk/react", () => ({
  useSignIn: () => ({ signIn: mockSignIn, fetchStatus: "idle", errors: {} }),
}));

beforeEach(() => {
  mockSignIn = buildSignInResource();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { assign: vi.fn(), origin: "http://localhost:5174", href: "http://localhost:5174/" },
  });
});

describe("SignInForm — a11y", () => {
  it("renders without axe-detectable accessibility violations", async () => {
    const { container } = renderWithProviders(<SignInForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
