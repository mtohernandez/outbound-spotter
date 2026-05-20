import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AuthFooter } from "./auth-footer";

describe("AuthFooter", () => {
  it("renders the current year in the copyright string", () => {
    const { getByText } = render(<AuthFooter />);

    expect(getByText(new RegExp(`${new Date().getFullYear()}`))).toBeInTheDocument();
  });

  it("renders Privacy and Terms links inside a labelled nav", () => {
    const { getByRole } = render(<AuthFooter />);

    const nav = getByRole("navigation", { name: /legal/i });
    expect(nav).toBeInTheDocument();
    expect(getByRole("link", { name: /privacy/i })).toBeInTheDocument();
    expect(getByRole("link", { name: /terms/i })).toBeInTheDocument();
  });

  it("prevents navigation when a footer link is clicked (placeholder pages)", async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<AuthFooter />);

    const initialHash = window.location.hash;
    await user.click(getByRole("link", { name: /privacy/i }));

    expect(window.location.hash).toBe(initialHash);
  });
});
