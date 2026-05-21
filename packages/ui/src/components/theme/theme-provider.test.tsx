import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "./theme-provider";
import { useTheme } from "./use-theme";

function Probe() {
  const { theme, resolvedTheme } = useTheme();
  return <div data-testid="probe" data-theme={theme} data-resolved={resolvedTheme} />;
}

describe("ThemeProvider", () => {
  it("hydrates the initial theme from localStorage when a valid value is present", () => {
    window.localStorage.setItem("outbound-theme", "dark");

    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(getByTestId("probe").getAttribute("data-theme")).toBe("dark");
    expect(getByTestId("probe").getAttribute("data-resolved")).toBe("dark");
  });

  it("falls back to defaultTheme when localStorage is empty", () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="light">
        <Probe />
      </ThemeProvider>,
    );

    expect(getByTestId("probe").getAttribute("data-theme")).toBe("light");
    expect(getByTestId("probe").getAttribute("data-resolved")).toBe("light");
  });

  it("ignores an invalid stored value and falls back to defaultTheme", () => {
    window.localStorage.setItem("outbound-theme", "neon");

    const { getByTestId } = render(
      <ThemeProvider defaultTheme="light">
        <Probe />
      </ThemeProvider>,
    );

    expect(getByTestId("probe").getAttribute("data-theme")).toBe("light");
  });

  it("applies the dark class on document.documentElement when resolvedTheme is dark", () => {
    window.localStorage.setItem("outbound-theme", "dark");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists setTheme to localStorage and removes the dark class when switching to light", () => {
    window.localStorage.setItem("outbound-theme", "dark");

    function Switcher() {
      const { setTheme } = useTheme();
      return (
        <button
          type="button"
          onClick={() => {
            setTheme("light");
          }}
        >
          go light
        </button>
      );
    }

    const { getByRole } = render(
      <ThemeProvider>
        <Switcher />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      getByRole("button").click();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("outbound-theme")).toBe("light");
  });
});
