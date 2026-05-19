import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "./theme-provider";
import { useTheme } from "./use-theme";

function Consumer() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <span data-testid="probe" data-theme={theme} data-resolved={resolvedTheme}>
      {theme}
    </span>
  );
}

describe("useTheme", () => {
  it("throws when used outside a ThemeProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress React's expected error log for the throwing render.
    });

    expect(() => render(<Consumer />)).toThrow(/ThemeProvider/);

    consoleError.mockRestore();
  });

  it("returns the context value when wrapped in a ThemeProvider", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <Consumer />
      </ThemeProvider>,
    );

    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-theme")).toBe("dark");
    expect(probe.getAttribute("data-resolved")).toBe("dark");
  });
});
