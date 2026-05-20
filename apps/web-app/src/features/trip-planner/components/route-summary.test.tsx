import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RouteSummary } from "@/features/trip-planner/components/route-summary";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { renderWithProviders } from "@/testing/render";

const PLANNED_TRIP: TripResponse = {
  id: "trip-1",
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
    [-77.4605, 38.3032],
    [-74.1724, 40.7357],
  ],
  route_segments: [
    { distance_mi: 67.4, duration_s: 4321, from_index: 0, to_index: 1 },
    { distance_mi: 275.3, duration_s: 14760, from_index: 1, to_index: 2 },
  ],
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
};

describe("RouteSummary", () => {
  it("renders hero metrics + per-leg rows for a planned trip", () => {
    renderWithProviders(<RouteSummary trip={PLANNED_TRIP} />);

    expect(screen.getByText(/total distance/i)).toBeInTheDocument();
    expect(screen.getByText(/total duration/i)).toBeInTheDocument();
    expect(screen.getByText("342.7 mi")).toBeInTheDocument();
    expect(screen.getByText("5h 18m")).toBeInTheDocument();
    expect(screen.getByText(/Current → Pickup/i)).toBeInTheDocument();
    expect(screen.getByText(/Pickup → Dropoff/i)).toBeInTheDocument();
  });
});
