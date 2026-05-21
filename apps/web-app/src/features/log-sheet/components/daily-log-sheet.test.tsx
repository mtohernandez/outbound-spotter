import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DailyLogSheet } from "@/features/log-sheet/components/daily-log-sheet";
import { createEmptyMetadata } from "@/features/log-sheet/types/sheet-metadata";
import type { LogDay, LogEvent, TripStop } from "@/features/trip-planner/schemas/trip-plan";

const TRIP = {
  current_label: "Richmond, VA",
  pickup_label: "Fredericksburg, VA",
  dropoff_label: "Newark, NJ",
};

const DAY: LogDay = {
  id: "00000000-0000-4000-8000-000000000301",
  date: "2026-05-21",
  off_duty_s: 0,
  sleeper_s: 0,
  driving_s: 22_500,
  on_duty_not_driving_s: 8_100,
  total_miles: 342.7,
};

const EVENTS: LogEvent[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    sequence: 0,
    status: "on_duty_not_driving",
    start: "2026-05-21T14:00:00-04:00",
    duration_s: 900,
    location: "Richmond, VA",
    note: "Pre-trip inspection",
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    sequence: 1,
    status: "driving",
    start: "2026-05-21T14:15:00-04:00",
    duration_s: 4500,
    location: "Richmond, VA",
    note: "En route",
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    sequence: 4,
    status: "on_duty_not_driving",
    start: "2026-05-21T21:30:00-04:00",
    duration_s: 3600,
    location: "Newark, NJ",
    note: "Dropoff",
  },
];

const STOPS: TripStop[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    kind: "pickup",
    sequence: 0,
    polyline_index: 1,
    lat: 38.3032,
    lon: -77.4605,
    label: "Fredericksburg, VA",
    scheduled_at: "2026-05-21T15:30:00-04:00",
    duration_s: 3600,
  },
];

function renderSheet(overrides: Partial<Parameters<typeof DailyLogSheet>[0]> = {}) {
  const props = {
    day: DAY,
    events: EVENTS,
    stops: STOPS,
    trip: TRIP,
    homeTerminalTz: "America/New_York",
    driverLegalName: "Jane Driver",
    metadata: createEmptyMetadata(),
    onMetadataChange: () => undefined,
    sheetId: "sheet-1",
    ...overrides,
  };
  render(
    <TooltipProvider>
      <DailyLogSheet {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe("DailyLogSheet", () => {
  it("renders a labeled SVG with a <title> and <desc>", () => {
    renderSheet();
    const svg = screen.getByRole("img");
    const titleId = svg.getAttribute("aria-labelledby");
    const descId = svg.getAttribute("aria-describedby");
    expect(titleId).not.toBeNull();
    expect(descId).not.toBeNull();
    expect(svg.querySelector(`title#${titleId}`)?.textContent).toContain("Daily Log");
    expect(svg.querySelector(`desc#${descId}`)?.textContent).toContain("Total 8h 30m");
  });

  it("titles the sheet with the date formatted in the home-terminal tz", () => {
    renderSheet();
    const svg = screen.getByRole("img");
    expect(svg.querySelector("title")?.textContent).toContain("Thursday, May 21, 2026");
  });

  it("does not render the signature <text> when iCertify is false", () => {
    renderSheet({ metadata: { ...createEmptyMetadata(), iCertify: false } });
    expect(document.querySelector("[data-slot='sheet-signature']")).toBeNull();
  });

  it("renders the signature <text> with the driver legal name when certified", () => {
    renderSheet({
      metadata: { ...createEmptyMetadata(), iCertify: true },
      driverLegalName: "Jane Driver",
    });
    const sig = document.querySelector("[data-slot='sheet-signature']");
    expect(sig).not.toBeNull();
    expect(sig?.textContent).toBe("Jane Driver");
    expect(sig?.getAttribute("font-style")).toBe("italic");
  });

  it("renders the signature override over the legal name when set + certified", () => {
    renderSheet({
      metadata: { ...createEmptyMetadata(), iCertify: true, signatureOverride: "J. M. Driver" },
      driverLegalName: "Jane Driver",
    });
    expect(document.querySelector("[data-slot='sheet-signature']")?.textContent).toBe(
      "J. M. Driver",
    );
  });

  it("renders the header, footer, grid frame, and totals column", () => {
    renderSheet();
    // Header (HTML)
    expect(screen.getByText(/Driver.*s Daily Log/i)).toBeInTheDocument();
    // Footer (HTML)
    expect(screen.getByRole("heading", { name: /Shipping Documents/i })).toBeInTheDocument();
    // Grid + totals (SVG slots)
    expect(document.querySelector("[data-slot='grid-frame']")).not.toBeNull();
    expect(document.querySelector("[data-slot='totals-column']")).not.toBeNull();
    expect(document.querySelector("[data-slot='duty-status-grid']")).not.toBeNull();
    expect(document.querySelector("[data-slot='remarks-column']")).not.toBeNull();
  });
});
