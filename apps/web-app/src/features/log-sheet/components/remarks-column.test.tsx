import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GRID_X } from "@/features/log-sheet/components/grid-geometry";
import { RemarksColumn } from "@/features/log-sheet/components/remarks-column";
import type { EventFragment } from "@/features/log-sheet/utils/events-by-day";
import type { LogEvent, TripStop } from "@/features/trip-planner/schemas/trip-plan";

const TRIP = {
  current_label: "Richmond, VA",
  pickup_label: "Fredericksburg, VA",
  dropoff_label: "Newark, NJ",
};

function svgHarness(children: React.ReactElement): HTMLElement {
  const { container } = render(
    <svg width={1000} height={800} viewBox="0 0 1000 800">
      {children}
    </svg>,
  );
  return container;
}

function makeEvent(partial: Partial<LogEvent>): LogEvent {
  return {
    id: partial.id ?? "00000000-0000-4000-8000-000000000001",
    sequence: partial.sequence ?? 0,
    status: partial.status ?? "driving",
    start: partial.start ?? "2026-05-21T14:00:00-04:00",
    duration_s: partial.duration_s ?? 3600,
    location: partial.location ?? "",
    note: partial.note ?? "",
  };
}

function makeFragment(
  event: LogEvent,
  startX: number,
  endX: number,
  startsBefore = false,
): EventFragment {
  return { event, startX, endX, startsBefore, endsAfter: false };
}

describe("RemarksColumn", () => {
  it("renders the section heading", () => {
    const container = svgHarness(
      <RemarksColumn fragments={[]} events={[]} stops={[]} trip={TRIP} />,
    );
    expect(container.textContent).toContain("Remarks");
  });

  it("emits one labeled callout per non-startsBefore fragment", () => {
    const event = makeEvent({ sequence: 2, note: "Pickup" });
    const fragments = [makeFragment(event, 96, 192)];
    const container = svgHarness(
      <RemarksColumn fragments={fragments} events={[event]} stops={[]} trip={TRIP} />,
    );
    const remarks = container.querySelectorAll("[data-slot='remark']");
    expect(remarks).toHaveLength(1);
    expect(container.textContent).toContain("Fredericksburg, VA");
  });

  it("uses three-tier precedence: tier 1 (trip-level) > tier 3 (location)", () => {
    const pickupEvent = makeEvent({
      sequence: 2,
      note: "Pickup",
      location: "Some Other Spot",
    });
    const fragments = [makeFragment(pickupEvent, 100, 200)];
    const container = svgHarness(
      <RemarksColumn fragments={fragments} events={[pickupEvent]} stops={[]} trip={TRIP} />,
    );
    expect(container.textContent).toContain("Fredericksburg, VA");
    expect(container.textContent).not.toContain("Some Other Spot");
  });

  it("skips fragments that started on a previous day", () => {
    const event = makeEvent({ note: "Pickup" });
    const fragments = [makeFragment(event, 0, 100, true)];
    const container = svgHarness(
      <RemarksColumn fragments={fragments} events={[event]} stops={[]} trip={TRIP} />,
    );
    expect(container.querySelectorAll("[data-slot='remark']")).toHaveLength(0);
  });

  it("falls through to TripStop.label when no tier-1 hit but a labeled stop matches", () => {
    // A 30-minute break is logged as off-duty (or on-duty-not-driving) per
    // §395.3(a)(3)(ii) — NOT as driving — so it won't hit the "first driving
    // event" tier-1 branch. The labeled stop wins tier 2.
    const event = makeEvent({
      status: "off_duty",
      start: "2026-05-21T18:00:00-04:00",
      note: "30-min break",
      location: "",
    });
    const stops: TripStop[] = [
      {
        id: "00000000-0000-4000-8000-000000000301",
        kind: "break",
        sequence: 0,
        polyline_index: 1,
        lat: 39.0,
        lon: -76.0,
        label: "Truck Stop — Wilmington, DE",
        scheduled_at: "2026-05-21T18:01:00-04:00",
        duration_s: 1800,
      },
    ];
    const fragments = [makeFragment(event, 100, 200)];
    const container = svgHarness(
      <RemarksColumn fragments={fragments} events={[event]} stops={stops} trip={TRIP} />,
    );
    expect(container.textContent).toContain("Truck Stop — Wilmington, DE");
  });

  it("anchors the leader line at the fragment's start x-coordinate", () => {
    const event = makeEvent({ note: "Pickup" });
    const fragments = [makeFragment(event, 96, 192)];
    const container = svgHarness(
      <RemarksColumn fragments={fragments} events={[event]} stops={[]} trip={TRIP} />,
    );
    const remark = container.querySelector("[data-slot='remark']");
    const lines = remark?.querySelectorAll("line") ?? [];
    expect(lines[0]?.getAttribute("x1")).toBe(String(GRID_X + 96));
  });
});
