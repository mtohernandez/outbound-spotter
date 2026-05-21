import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("renders the full wordmark with the default aria-label", () => {
    const { getByRole } = render(<BrandMark />);

    const svg = getByRole("img", { name: "Outbound Spotter" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("uses the provided aria-label when supplied", () => {
    const { getByRole } = render(<BrandMark aria-label="Outbound Spotter — home" />);

    expect(getByRole("img", { name: "Outbound Spotter — home" })).toBeInTheDocument();
  });

  it("paints every fill with currentColor when variant is mark-only", () => {
    const { container } = render(<BrandMark variant="mark-only" aria-label="logo" />);

    const filled = container.querySelectorAll("[fill]");
    expect(filled.length).toBeGreaterThan(0);
    filled.forEach((node) => {
      expect(node.getAttribute("fill")).toBe("currentColor");
    });
  });

  it("uses the OKLCH ramp CSS variables in the full variant (no hex literals)", () => {
    const { container } = render(<BrandMark variant="full" aria-label="logo" />);

    const filled = container.querySelectorAll("[fill]");
    expect(filled.length).toBeGreaterThan(0);
    filled.forEach((node) => {
      const fill = node.getAttribute("fill") ?? "";
      expect(fill.startsWith("var(--")).toBe(true);
    });
  });

  it("forwards a ref to the underlying svg element", () => {
    const ref = createRef<SVGSVGElement>();
    render(<BrandMark ref={ref} aria-label="logo" />);

    expect(ref.current).toBeInstanceOf(SVGSVGElement);
  });
});
