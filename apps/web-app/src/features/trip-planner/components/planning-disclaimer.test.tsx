import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PLANNING_DISCLAIMER } from "@/config/strings";
import { PlanningDisclaimer } from "@/features/trip-planner/components/planning-disclaimer";

describe("PlanningDisclaimer", () => {
  it("renders the canonical disclaimer string", () => {
    render(<PlanningDisclaimer />);
    expect(screen.getByText(PLANNING_DISCLAIMER)).toBeInTheDocument();
  });

  it("uses muted-foreground styling so the strip reads as ambient legal text", () => {
    render(<PlanningDisclaimer />);
    const node = screen.getByTestId("planning-disclaimer");
    expect(node.className).toMatch(/text-muted-foreground/);
    expect(node.className).toMatch(/text-xs/);
  });
});
