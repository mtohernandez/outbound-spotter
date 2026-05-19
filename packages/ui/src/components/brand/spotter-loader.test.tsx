import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpotterLoader } from "./spotter-loader";

describe("SpotterLoader", () => {
  it("exposes role=status with the default aria-label", () => {
    const { getByRole } = render(<SpotterLoader />);

    const status = getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading");
  });

  it("overrides the aria-label when supplied", () => {
    const { getByRole } = render(<SpotterLoader aria-label="Fetching trip plan" />);

    expect(getByRole("status")).toHaveAttribute("aria-label", "Fetching trip plan");
  });

  it("renders four circles laid out per the brand mark", () => {
    const { container } = render(<SpotterLoader />);

    expect(container.querySelectorAll("circle")).toHaveLength(4);
  });

  it.each([
    ["sm", "size-4"],
    ["md", "size-6"],
    ["lg", "size-10"],
  ] as const)("applies the %s size class %s", (size, expectedClass) => {
    const { getByRole } = render(<SpotterLoader size={size} aria-label="loading" />);

    expect(getByRole("status").className).toContain(expectedClass);
  });

  it("gates the orbit animation behind prefers-reduced-motion: no-preference", () => {
    const { container } = render(<SpotterLoader aria-label="loading" />);

    const style = container.querySelector("style");
    expect(style?.textContent).toContain("@media (prefers-reduced-motion: no-preference)");
  });
});
