import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("SignInForm", () => {
  it("renders the email, password, OAuth button, and forgot-password link", () => {
    const { getByLabelText, getByRole } = renderWithProviders(<SignInForm />);

    expect(getByLabelText("Email")).toBeInTheDocument();
    expect(getByLabelText("Password")).toBeInTheDocument();
    expect(getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/sign-up");
  });

  it("calls signIn.password and finalize on a successful submit", async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByRole } = renderWithProviders(<SignInForm />);

    await user.type(getByLabelText("Email"), "driver@example.com");
    await user.type(getByLabelText("Password"), "anything");
    await user.click(getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockSignIn.password).toHaveBeenCalledWith({
        identifier: "driver@example.com",
        password: "anything",
      });
    });
    expect(mockSignIn.finalize).toHaveBeenCalledOnce();
  });

  it("renders the server error in an assertive region when signIn.password fails", async () => {
    mockSignIn.password.mockResolvedValueOnce({
      error: { code: "form_password_incorrect", message: "Wrong password." },
    });
    const user = userEvent.setup();
    const { getByLabelText, getByRole, findByRole } = renderWithProviders(<SignInForm />);

    await user.type(getByLabelText("Email"), "driver@example.com");
    await user.type(getByLabelText("Password"), "wrong");
    await user.click(getByRole("button", { name: "Sign in" }));

    const alert = await findByRole("alert");
    expect(alert).toHaveTextContent(/wrong password/i);
  });

  it("invokes signIn.sso when the Google button is clicked", async () => {
    const user = userEvent.setup();
    const { getByRole } = renderWithProviders(<SignInForm />);

    await user.click(getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(mockSignIn.sso).toHaveBeenCalledWith({
        strategy: "oauth_google",
        redirectUrl: expect.any(String),
        redirectCallbackUrl: expect.stringContaining("/sso-callback"),
      });
    });
  });
});
