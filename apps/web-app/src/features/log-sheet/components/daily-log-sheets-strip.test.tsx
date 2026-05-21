import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { buildClerkMocks } from "@/testing/clerk-mocks";

function renderInProviders(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useUser: clerk.useUser,
  useAuth: clerk.useAuth,
}));

const { DailyLogSheetsStrip } =
  await import("@/features/log-sheet/components/daily-log-sheets-strip");

const TRIP: TripResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-05-20T00:00:00Z",
  start_at: "2026-05-21T14:00:00-04:00",
  current_label: "Richmond, VA",
  current_lat: 37.5407,
  current_lon: -77.436,
  pickup_label: "Fredericksburg, VA",
  pickup_lat: 38.3032,
  pickup_lon: -77.4605,
  dropoff_label: "Newark, NJ",
  dropoff_lat: 40.7357,
  dropoff_lon: -74.1724,
  cycle_hours_used: "35.0",
  route_polyline: [
    [-77.436, 37.5407],
    [-74.1724, 40.7357],
  ],
  route_segments: [],
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
};

function makePlan(days: TripPlan["days"]): TripPlan {
  return {
    trip_id: TRIP.id,
    start_at: TRIP.start_at,
    home_terminal_tz: "America/New_York",
    stops: [],
    events: [],
    days,
  };
}

const SINGLE_DAY: TripPlan["days"] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    date: "2026-05-21",
    off_duty_s: 0,
    sleeper_s: 0,
    driving_s: 22_500,
    on_duty_not_driving_s: 8_100,
    total_miles: 342.7,
  },
];

const MULTI_DAY: TripPlan["days"] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    date: "2026-05-21",
    off_duty_s: 0,
    sleeper_s: 0,
    driving_s: 39_600,
    on_duty_not_driving_s: 7_200,
    total_miles: 600.5,
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    date: "2026-05-22",
    off_duty_s: 36_000,
    sleeper_s: 0,
    driving_s: 39_600,
    on_duty_not_driving_s: 10_800,
    total_miles: 612.4,
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    date: "2026-05-23",
    off_duty_s: 36_000,
    sleeper_s: 0,
    driving_s: 36_000,
    on_duty_not_driving_s: 14_400,
    total_miles: 580.2,
  },
];

describe("DailyLogSheetsStrip", () => {
  it("renders one DailyLogSheet per LogDay in ascending date order", () => {
    renderInProviders(<DailyLogSheetsStrip trip={TRIP} plan={makePlan(MULTI_DAY)} />);
    const sheets = document.querySelectorAll("[data-slot='daily-log-sheet']");
    expect(sheets).toHaveLength(3);
    const ids = Array.from(sheets).map((s) => s.getAttribute("data-sheet-id"));
    expect(ids).toEqual([
      "sheet-00000000-0000-4000-8000-000000000301",
      "sheet-00000000-0000-4000-8000-000000000302",
      "sheet-00000000-0000-4000-8000-000000000303",
    ]);
  });

  it("renders date headers per day in the home-terminal tz", () => {
    renderInProviders(<DailyLogSheetsStrip trip={TRIP} plan={makePlan(MULTI_DAY)} />);
    // Each day's header is matched by the strip's `<h3>` (with "Day N of 3"
    // suffix); the inner SVG title also carries the date so getAllByText
    // returns multiple — scope to the strip's H3 headings.
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingText = headings.map((h) => h.textContent).join(" | ");
    expect(headingText).toContain("Thursday, May 21, 2026");
    expect(headingText).toContain("Friday, May 22, 2026");
    expect(headingText).toContain("Saturday, May 23, 2026");
  });

  it("uses Clerk's user to pre-fill the driver legal name on every sheet", () => {
    renderInProviders(<DailyLogSheetsStrip trip={TRIP} plan={makePlan(SINGLE_DAY)} />);
    // Clerk mock returns Jane Driver
    expect(screen.getAllByText("Jane Driver").length).toBeGreaterThanOrEqual(1);
  });

  it("renders an empty-state message when the plan has no log days", () => {
    renderInProviders(<DailyLogSheetsStrip trip={TRIP} plan={makePlan([])} />);
    expect(screen.getByText(/No log days were planned for this trip/i)).toBeInTheDocument();
  });

  it("shares the SheetMetadata across every sheet in the strip", async () => {
    const user = userEvent.setup();
    renderInProviders(<DailyLogSheetsStrip trip={TRIP} plan={makePlan(MULTI_DAY)} />);

    // Each sheet has its own truck input, but they're all wired through the
    // strip-level useState, so typing into day 1's input must reflect in day 2/3.
    const truckInputs = screen.getAllByLabelText("Truck or Tractor number");
    expect(truckInputs).toHaveLength(3);
    await user.type(truckInputs[0]!, "T-42");
    expect(truckInputs[0]).toHaveValue("T-42");
    expect(truckInputs[1]).toHaveValue("T-42");
    expect(truckInputs[2]).toHaveValue("T-42");
  });

  it("renders the strip as a vertical scroll container", () => {
    renderInProviders(<DailyLogSheetsStrip trip={TRIP} plan={makePlan(SINGLE_DAY)} />);
    const strip = document.querySelector("[data-slot='daily-log-sheets-strip']");
    expect(strip).toHaveClass("overflow-y-auto");
  });
});
