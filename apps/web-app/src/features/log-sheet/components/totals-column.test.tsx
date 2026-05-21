import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TotalsColumn } from "@/features/log-sheet/components/totals-column";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

function svgHarness(children: React.ReactElement): HTMLElement {
  const { container } = render(
    <svg width={1000} height={500} viewBox="0 0 1000 500">
      {children}
    </svg>,
  );
  return container;
}

function makeDay(partial: Partial<LogDay>): LogDay {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    date: "2026-05-21",
    off_duty_s: 0,
    sleeper_s: 0,
    driving_s: 0,
    on_duty_not_driving_s: 0,
    total_miles: 0,
    ...partial,
  };
}

describe("TotalsColumn", () => {
  it("renders four per-status totals", () => {
    const day = makeDay({
      off_duty_s: 36_000, // 10h
      sleeper_s: 0,
      driving_s: 27_900, // 7h 45m
      on_duty_not_driving_s: 22_500, // 6h 15m
    });
    const container = svgHarness(<TotalsColumn day={day} />);
    expect(container.querySelector("[data-slot='total-off-duty']")?.textContent).toBe("10h 0m");
    expect(container.querySelector("[data-slot='total-sleeper-berth']")?.textContent).toBe("0h 0m");
    expect(container.querySelector("[data-slot='total-driving']")?.textContent).toBe("7h 45m");
    expect(container.querySelector("[data-slot='total-on-duty-not-driving']")?.textContent).toBe(
      "6h 15m",
    );
  });

  it("renders the bottom 24h total when the day sums to exactly 86400 seconds", () => {
    const day = makeDay({
      off_duty_s: 36_000,
      sleeper_s: 0,
      driving_s: 27_900,
      on_duty_not_driving_s: 22_500,
    });
    const container = svgHarness(<TotalsColumn day={day} />);
    expect(container.querySelector("[data-slot='total-day']")?.textContent).toBe("= 24h 0m");
  });

  it("never emits a hex literal", () => {
    const day = makeDay({ driving_s: 3600 });
    const container = svgHarness(<TotalsColumn day={day} />);
    Array.from(container.querySelectorAll("*")).forEach((node) => {
      ["fill", "stroke", "style"].forEach((attr) => {
        const v = node.getAttribute(attr);
        if (v !== null) expect(v).not.toMatch(/#[0-9a-f]{3,8}/i);
      });
    });
  });

  it("renders the header label", () => {
    const day = makeDay({});
    const container = svgHarness(<TotalsColumn day={day} />);
    expect(container.textContent).toContain("Total Hours");
  });
});
