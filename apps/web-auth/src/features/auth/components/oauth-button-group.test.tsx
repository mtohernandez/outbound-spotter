import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OAuthButtonGroup } from "./oauth-button-group";

describe("OAuthButtonGroup", () => {
  it("renders a single Continue-with-Google button", () => {
    const { getByRole, queryByRole } = render(<OAuthButtonGroup onContinueWithGoogle={vi.fn()} />);

    expect(getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(queryByRole("button", { name: /apple/i })).toBeNull();
  });

  it("invokes the handler on click", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();

    const { getByRole } = render(<OAuthButtonGroup onContinueWithGoogle={handler} />);
    await user.click(getByRole("button", { name: /continue with google/i }));

    expect(handler).toHaveBeenCalledOnce();
  });

  it("respects the disabled prop", () => {
    const { getByRole } = render(<OAuthButtonGroup onContinueWithGoogle={vi.fn()} disabled />);

    expect(getByRole("button", { name: /continue with google/i })).toBeDisabled();
  });
});
