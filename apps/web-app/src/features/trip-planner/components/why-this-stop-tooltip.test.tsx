import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STOP_KIND_META } from "@/features/trip-planner/components/map/stop-kind-labels";
import { WhyThisStopTooltip } from "@/features/trip-planner/components/why-this-stop-tooltip";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

const KINDS: readonly StopKind[] = ["pickup", "dropoff", "fuel", "break", "sleeper", "restart"];

describe("WhyThisStopTooltip", () => {
  it.each(KINDS)("renders the STOP_KIND_META reason for kind %s", (kind) => {
    render(
      <TooltipProvider delayDuration={0}>
        <WhyThisStopTooltip kind={kind} defaultOpen>
          <button type="button">{kind}</button>
        </WhyThisStopTooltip>
      </TooltipProvider>,
    );

    // Radix tooltip renders the reason in both the visible content and a
    // mirrored screen-reader span; both should match.
    expect(screen.getAllByText(STOP_KIND_META[kind].reason).length).toBeGreaterThan(0);
  });
});
