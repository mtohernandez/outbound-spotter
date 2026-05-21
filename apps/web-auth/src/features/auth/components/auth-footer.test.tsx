import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthFooter } from "./auth-footer";

describe("AuthFooter", () => {
  it("renders the current year in the copyright string", () => {
    const { getByText } = render(<AuthFooter />);

    expect(getByText(new RegExp(`${new Date().getFullYear()}`))).toBeInTheDocument();
  });

  it("renders Privacy and Terms as decorative text (no anchors, no navigation)", () => {
    const { getByText, queryByRole } = render(<AuthFooter />);

    expect(getByText(/privacy/i)).toBeInTheDocument();
    expect(getByText(/terms/i)).toBeInTheDocument();
    expect(queryByRole("link")).toBeNull();
  });
});
