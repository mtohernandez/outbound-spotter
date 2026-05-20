import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PasswordStrengthMeter } from "./password-strength-meter";

describe("PasswordStrengthMeter", () => {
  it("renders the empty-state label when no password is supplied", () => {
    const { getByText } = render(<PasswordStrengthMeter value="" />);

    expect(getByText(/enter a password/i)).toBeInTheDocument();
  });

  it("scores the password and announces the resulting strength label", async () => {
    const onScoreChange = vi.fn();

    const { getByText } = render(
      <PasswordStrengthMeter value="L8!#qfPo-2VsW#tr%3" onScoreChange={onScoreChange} />,
    );

    await waitFor(() => {
      expect(onScoreChange).toHaveBeenCalled();
    });
    expect(getByText(/strong|very strong/i)).toBeInTheDocument();
  });

  it("downgrades to a low score for a common password and reports via onScoreChange", async () => {
    const onScoreChange = vi.fn();

    render(<PasswordStrengthMeter value="password" onScoreChange={onScoreChange} />);

    await waitFor(() => {
      expect(onScoreChange).toHaveBeenCalled();
    });
    const reported = onScoreChange.mock.calls.at(-1)?.[0];
    expect(reported).toBeLessThanOrEqual(1);
  });
});
