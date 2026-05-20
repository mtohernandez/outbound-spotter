import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HeaderActions } from "./header-actions";

describe("HeaderActions", () => {
  it("renders the BrandMark and the ThemeToggle inside a theme provider", () => {
    const { getByRole } = render(
      <ThemeProvider>
        <HeaderActions />
      </ThemeProvider>,
    );

    expect(getByRole("img", { name: /outbound spotter/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /toggle theme|theme/i })).toBeInTheDocument();
  });
});
