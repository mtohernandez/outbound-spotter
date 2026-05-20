import { describe, expect, it, vi } from "vitest";

import { buildSignInResource } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

import { ForgotPasswordRoute } from "./forgot-password";

vi.mock("@clerk/react", () => ({
  useSignIn: () => ({ signIn: buildSignInResource(), fetchStatus: "idle", errors: {} }),
}));

describe("ForgotPasswordRoute", () => {
  it("renders the request-stage heading", () => {
    const { getByRole } = renderWithProviders(<ForgotPasswordRoute />);

    expect(getByRole("button", { name: /send reset code/i })).toBeInTheDocument();
  });
});
