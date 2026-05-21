import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildSignUpResource, type MockSignUp } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

import { SignUpForm } from "./sign-up-form";

let mockSignUp: MockSignUp;

vi.mock("@clerk/react", () => ({
  useSignUp: () => ({ signUp: mockSignUp, fetchStatus: "idle", errors: {} }),
}));

beforeEach(() => {
  mockSignUp = buildSignUpResource({
    status: "missing_requirements",
    createdSessionId: null,
  });
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { assign: vi.fn(), origin: "http://localhost:5174", href: "http://localhost:5174/" },
  });
});

describe("SignUpForm", () => {
  it("renders the captcha mount point in the collect phase", () => {
    const { container, getByLabelText } = renderWithProviders(<SignUpForm />);

    expect(getByLabelText("Email")).toBeInTheDocument();
    expect(getByLabelText("Password")).toBeInTheDocument();
    expect(container.querySelector("#clerk-captcha")).not.toBeNull();
  });

  it("transitions to the verifying phase after a successful signUp.password", async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByRole, getByText, findByRole } = renderWithProviders(
      <SignUpForm />,
    );

    await user.type(getByLabelText("Email"), "driver@example.com");
    await user.type(getByLabelText("Password"), "L8!#qfPo-2VsW#tr%3");

    // Wait for the async strength meter to score (debounced 150 ms + zxcvbn run).
    await waitFor(
      () => {
        expect(getByText(/strong|very strong/i)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    await user.click(getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(mockSignUp.password).toHaveBeenCalledWith({
        emailAddress: "driver@example.com",
        password: "L8!#qfPo-2VsW#tr%3",
      });
    });
    expect(mockSignUp.verifications.sendEmailCode).toHaveBeenCalledOnce();
    expect(await findByRole("group", { name: /verification code/i })).toBeInTheDocument();
  });

  it("blocks submission client-side when password strength is too weak", async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByRole } = renderWithProviders(<SignUpForm />);

    await user.type(getByLabelText("Email"), "driver@example.com");
    await user.type(getByLabelText("Password"), "weakpass1");
    await user.click(getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(mockSignUp.password).not.toHaveBeenCalled();
    });
  });

  it("surfaces Clerk's compromised-password error in the assertive region", async () => {
    mockSignUp.password.mockResolvedValueOnce({
      error: { code: "form_password_pwned", message: "Pick a less common password." },
    });
    const user = userEvent.setup();
    const { getByLabelText, getByRole, getByText, findByRole } = renderWithProviders(
      <SignUpForm />,
    );

    await user.type(getByLabelText("Email"), "driver@example.com");
    await user.type(getByLabelText("Password"), "L8!#qfPo-2VsW#tr%3");
    await waitFor(
      () => {
        expect(getByText(/strong|very strong/i)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    await user.click(getByRole("button", { name: "Create account" }));

    const alert = await findByRole("alert");
    expect(alert).toHaveTextContent(/less common/i);
  });
});
