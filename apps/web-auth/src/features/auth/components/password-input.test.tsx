import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("renders a password input with the requested autocomplete", () => {
    const { getByLabelText } = render(
      <>
        <label htmlFor="pw-1">Account password</label>
        <PasswordInput id="pw-1" autoComplete="current-password" />
      </>,
    );

    const input = getByLabelText("Account password") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.autocomplete).toBe("current-password");
  });

  it("toggles type and aria-pressed when the show-password button is clicked", async () => {
    const user = userEvent.setup();
    const { getByRole, getByLabelText } = render(
      <>
        <label htmlFor="pw-2">Account password</label>
        <PasswordInput id="pw-2" />
      </>,
    );

    const input = getByLabelText("Account password") as HTMLInputElement;
    const toggle = getByRole("button", { name: /password visibility/i });

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(input.type).toBe("password");

    await user.click(toggle);

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(input.type).toBe("text");
  });

  it("forwards the ref to the underlying input", () => {
    let captured: HTMLInputElement | null = null;
    render(
      <PasswordInput
        ref={(node) => {
          captured = node;
        }}
      />,
    );

    expect(captured).not.toBeNull();
    expect((captured as unknown as HTMLInputElement).tagName).toBe("INPUT");
  });
});
