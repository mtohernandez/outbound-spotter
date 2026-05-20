import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/testing/render";

import { VerificationStep } from "./verification-step";

const render = renderWithProviders;

describe("VerificationStep", () => {
  it("focuses the first OTP cell on mount", async () => {
    const { findAllByRole } = render(
      <VerificationStep
        emailAddress="driver@example.com"
        onVerify={vi.fn().mockResolvedValue(null)}
        onResend={vi.fn().mockResolvedValue(null)}
        onBack={vi.fn()}
      />,
    );

    const cells = await findAllByRole("textbox");
    await waitFor(() => {
      expect(document.activeElement).toBe(cells[0]);
    });
  });

  it("invokes onVerify with the typed 6-digit code", async () => {
    const onVerify = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();

    const { getAllByRole } = render(
      <VerificationStep
        emailAddress="driver@example.com"
        onVerify={onVerify}
        onResend={vi.fn().mockResolvedValue(null)}
        onBack={vi.fn()}
      />,
    );

    const cells = getAllByRole("textbox") as HTMLInputElement[];
    cells[0]?.focus();
    await user.keyboard("123456");

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith("123456");
    });
  });

  it("starts a 30-second resend cooldown after a successful resend", async () => {
    const onResend = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();

    const { getByRole } = render(
      <VerificationStep
        emailAddress="driver@example.com"
        onVerify={vi.fn().mockResolvedValue(null)}
        onResend={onResend}
        onBack={vi.fn()}
      />,
    );

    await user.click(getByRole("button", { name: /resend code/i }));

    await waitFor(() => {
      expect(getByRole("button", { name: /resend in/i })).toBeDisabled();
    });
  });

  it("calls onBack when the user clicks Use a different email", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();

    const { getByRole } = render(
      <VerificationStep
        emailAddress="driver@example.com"
        onVerify={vi.fn().mockResolvedValue(null)}
        onResend={vi.fn().mockResolvedValue(null)}
        onBack={onBack}
      />,
    );

    await user.click(getByRole("button", { name: /use a different email/i }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
