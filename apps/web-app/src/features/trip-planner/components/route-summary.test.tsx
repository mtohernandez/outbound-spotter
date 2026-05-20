import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RouteSummary } from "@/features/trip-planner/components/route-summary";
import type {
  RouteErrorCode,
  TripFailed,
  TripPlanned,
  TripPlanning,
} from "@/features/trip-planner/schemas/trip-response";
import { renderWithProviders } from "@/testing/render";

const PLANNED_TRIP: TripPlanned = {
  id: "trip-1",
  status: "planned",
  created_at: "2026-05-20T00:00:00Z",
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
    [-77.4605, 38.3032],
    [-74.1724, 40.7357],
  ],
  route_segments: [
    { distance_mi: 67.4, duration_s: 4321, from_index: 0, to_index: 1 },
    { distance_mi: 275.3, duration_s: 14760, from_index: 1, to_index: 2 },
  ],
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
  route_error_code: null,
};

const PLANNING_TRIP: TripPlanning = {
  ...PLANNED_TRIP,
  status: "planning",
  route_polyline: null,
  route_segments: null,
  route_summary: null,
  route_error_code: null,
};

function failedTrip(code: RouteErrorCode): TripFailed {
  return {
    ...PLANNED_TRIP,
    status: "failed",
    route_polyline: null,
    route_segments: null,
    route_summary: null,
    route_error_code: code,
  };
}

describe("RouteSummary", () => {
  it("renders hero metrics + per-leg rows on a planned trip", () => {
    renderWithProviders(<RouteSummary trip={PLANNED_TRIP} />);

    expect(screen.getByText(/total distance/i)).toBeInTheDocument();
    expect(screen.getByText(/total duration/i)).toBeInTheDocument();
    expect(screen.getByText("342.7 mi")).toBeInTheDocument();
    expect(screen.getByText("5h 18m")).toBeInTheDocument();
    expect(screen.getByText(/Current → Pickup/i)).toBeInTheDocument();
    expect(screen.getByText(/Pickup → Dropoff/i)).toBeInTheDocument();
    // Decision 22: status badge appears once per surface (in the side panel,
    // not the main route-summary card). Confirm the planned status text is
    // NOT rendered here.
    expect(screen.queryByText(/Planned/i)).not.toBeInTheDocument();
  });

  it("renders the loader on a planning trip", () => {
    const { container } = renderWithProviders(<RouteSummary trip={PLANNING_TRIP} />);

    // SpotterLoader is decorative (no role); assert by the visible loader span.
    expect(container.querySelector('[aria-label="Loading"]')).not.toBeNull();
  });

  it("renders the failed Empty with copy keyed by route_error_code", () => {
    renderWithProviders(<RouteSummary trip={failedTrip("rate_limit_daily")} />, {
      initialEntries: ["/trips/x"],
    });

    expect(screen.getByText(/daily routing quota exhausted/i)).toBeInTheDocument();
    expect(screen.getByText(/rate-limited until tomorrow/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plan a new trip/i })).toBeInTheDocument();
  });

  it("renders the rate_limit_per_minute copy", () => {
    renderWithProviders(<RouteSummary trip={failedTrip("rate_limit_per_minute")} />, {
      initialEntries: ["/trips/x"],
    });

    expect(screen.getByText(/routing service is busy/i)).toBeInTheDocument();
  });

  it("renders the upstream copy", () => {
    renderWithProviders(<RouteSummary trip={failedTrip("upstream")} />, {
      initialEntries: ["/trips/x"],
    });

    expect(screen.getByText(/couldn't reach the routing service/i)).toBeInTheDocument();
  });

  it("renders the validation copy", () => {
    renderWithProviders(<RouteSummary trip={failedTrip("validation")} />, {
      initialEntries: ["/trips/x"],
    });

    expect(screen.getByText(/couldn't plan this route/i)).toBeInTheDocument();
  });
});
