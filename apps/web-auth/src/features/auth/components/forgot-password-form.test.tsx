import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildSignInResource, type MockSignIn } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

import { ForgotPasswordForm } from "./forgot-password-form";

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

describe("ForgotPasswordForm", () => {
  it("renders the request stage by default", () => {
    const { getByLabelText, getByRole } = renderWithProviders(<ForgotPasswordForm />);

    expect(getByLabelText("Email")).toBeInTheDocument();
    expect(getByRole("button", { name: /send reset code/i })).toBeInTheDocument();
  });

  it("calls signIn.create + sendCode and advances to the verification stage", async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByRole, findByRole } = renderWithProviders(<ForgotPasswordForm />);

    await user.type(getByLabelText("Email"), "driver@example.com");
    await user.click(getByRole("button", { name: /send reset code/i }));

    await waitFor(() => {
      expect(mockSignIn.create).toHaveBeenCalledWith({ identifier: "driver@example.com" });
    });
    expect(mockSignIn.resetPasswordEmailCode.sendCode).toHaveBeenCalledOnce();
    expect(await findByRole("group", { name: /verification code/i })).toBeInTheDocument();
  });

  it("advances to the verification stage even on unknown email (OWASP non-enumeration)", async () => {
    mockSignIn.create.mockResolvedValueOnce({
      error: { code: "form_identifier_not_found", message: "no user" },
    });
    const user = userEvent.setup();
    const { getByLabelText, getByRole, findByRole } = renderWithProviders(<ForgotPasswordForm />);

    await user.type(getByLabelText("Email"), "missing@example.com");
    await user.click(getByRole("button", { name: /send reset code/i }));

    expect(await findByRole("group", { name: /verification code/i })).toBeInTheDocument();
  });
});
