import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DutyStatusGrid } from "@/features/log-sheet/components/duty-status-grid";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  GRID_X,
  GRID_Y,
  HOUR_WIDTH,
  ROW_HEIGHT,
} from "@/features/log-sheet/components/grid-geometry";
import type { EventFragment } from "@/features/log-sheet/utils/events-by-day";
import type { LogEvent } from "@/features/trip-planner/schemas/trip-plan";

function svgHarness(children: React.ReactElement): HTMLElement {
  const { container } = render(
    <svg width={1000} height={500} viewBox="0 0 1000 500">
      {children}
    </svg>,
  );
  return container;
}

function makeFragment(partial: {
  event: Partial<LogEvent>;
  startX: number;
  endX: number;
}): EventFragment {
  return {
    event: {
      id: partial.event.id ?? "00000000-0000-4000-8000-000000000001",
      sequence: partial.event.sequence ?? 0,
      status: partial.event.status ?? "driving",
      start: partial.event.start ?? "2026-05-21T14:00:00-04:00",
      duration_s: partial.event.duration_s ?? 3600,
      location: partial.event.location ?? "Richmond, VA",
      note: partial.event.note ?? "En route",
    },
    startX: partial.startX,
    endX: partial.endX,
    startsBefore: false,
    endsAfter: false,
  };
}

describe("DutyStatusGrid", () => {
  it("renders 4 row labels (one per duty status)", () => {
    const container = svgHarness(<DutyStatusGrid fragments={[]} />);
    expect(container.textContent).toContain("Off Duty");
    expect(container.textContent).toContain("Sleeper Berth");
    expect(container.textContent).toContain("Driving");
    expect(container.textContent).toContain("On Duty (Not Driving)");
  });

  it("renders 24 hour labels both above and below the grid", () => {
    const container = svgHarness(<DutyStatusGrid fragments={[]} />);
    const midOccurrences = container.querySelectorAll("text");
    const midTexts = Array.from(midOccurrences).filter((node) => node.textContent === "Mid");
    const noonTexts = Array.from(midOccurrences).filter((node) => node.textContent === "Noon");
    expect(midTexts).toHaveLength(2);
    expect(noonTexts).toHaveLength(2);
  });

  it("renders 25 vertical grid lines (24 hours + 1 boundary)", () => {
    const container = svgHarness(<DutyStatusGrid fragments={[]} />);
    const lines = container.querySelectorAll("line");
    const vGridLines = Array.from(lines).filter(
      (line) =>
        line.getAttribute("y1") === String(GRID_Y) &&
        line.getAttribute("y2") === String(GRID_Y + GRID_HEIGHT),
    );
    expect(vGridLines).toHaveLength(25);
  });

  it("renders 5 horizontal grid lines (4 rows + bottom edge)", () => {
    const container = svgHarness(<DutyStatusGrid fragments={[]} />);
    const lines = container.querySelectorAll("line");
    const hGridLines = Array.from(lines).filter(
      (line) =>
        line.getAttribute("x1") === String(GRID_X) &&
        line.getAttribute("x2") === String(GRID_X + GRID_WIDTH),
    );
    expect(hGridLines).toHaveLength(5);
  });

  it("draws a duty-status segment on the correct row at the correct x", () => {
    const fragment = makeFragment({
      event: { status: "driving", id: "00000000-0000-4000-8000-000000000201" },
      startX: HOUR_WIDTH * 14,
      endX: HOUR_WIDTH * 16,
    });
    const container = svgHarness(<DutyStatusGrid fragments={[fragment]} />);
    const group = container.querySelector("[data-slot='duty-fragment']");
    expect(group).not.toBeNull();
    const horizontals = group?.querySelectorAll("line") ?? [];
    const horizontal = Array.from(horizontals).find(
      (line) => line.getAttribute("x1") === String(GRID_X + HOUR_WIDTH * 14),
    );
    expect(horizontal).toBeDefined();
    expect(horizontal?.getAttribute("x2")).toBe(String(GRID_X + HOUR_WIDTH * 16));
    // driving row = index 2, center y = GRID_Y + 2*ROW_HEIGHT + ROW_HEIGHT/2
    expect(horizontal?.getAttribute("y1")).toBe(String(GRID_Y + 2 * ROW_HEIGHT + ROW_HEIGHT / 2));
  });

  it("draws a vertical transition between consecutive fragments that share an x", () => {
    const fragments: EventFragment[] = [
      makeFragment({
        event: { status: "driving", id: "00000000-0000-4000-8000-000000000301" },
        startX: HOUR_WIDTH * 14,
        endX: HOUR_WIDTH * 16,
      }),
      makeFragment({
        event: { status: "off_duty", id: "00000000-0000-4000-8000-000000000302" },
        startX: HOUR_WIDTH * 16,
        endX: HOUR_WIDTH * 17,
      }),
    ];
    const container = svgHarness(<DutyStatusGrid fragments={fragments} />);
    const groups = container.querySelectorAll("[data-slot='duty-fragment']");
    const firstGroupLines = groups[0]?.querySelectorAll("line");
    const verticals = Array.from(firstGroupLines ?? []).filter(
      (line) => line.getAttribute("x1") === line.getAttribute("x2"),
    );
    expect(verticals.length).toBeGreaterThanOrEqual(1);
    const drivingY = GRID_Y + 2 * ROW_HEIGHT + ROW_HEIGHT / 2;
    const offDutyY = GRID_Y + 0 * ROW_HEIGHT + ROW_HEIGHT / 2;
    const vertical = verticals.find(
      (line) =>
        Number(line.getAttribute("y1")) === drivingY &&
        Number(line.getAttribute("y2")) === offDutyY,
    );
    expect(vertical).toBeDefined();
  });

  it("contains zero hex literals in any stroke / fill / style attribute", () => {
    const fragment = makeFragment({
      event: { status: "driving" },
      startX: HOUR_WIDTH * 14,
      endX: HOUR_WIDTH * 16,
    });
    const container = svgHarness(<DutyStatusGrid fragments={[fragment]} />);
    const all = container.querySelectorAll("*");
    const HEX = /#[0-9a-f]{3,8}/i;
    Array.from(all).forEach((node) => {
      ["fill", "stroke", "style"].forEach((attr) => {
        const value = node.getAttribute(attr);
        if (value !== null)
          expect(value, `${attr}="${value}" on <${node.tagName}>`).not.toMatch(HEX);
      });
    });
  });
});
