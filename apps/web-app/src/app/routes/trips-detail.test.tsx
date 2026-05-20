import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";
import { server } from "@/testing/setup";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

// Stub the lazy TripMap so Vitest doesn't try to evaluate real Leaflet in jsdom.
// (Leaflet's MapContainer mounts an L.Map at module import; jsdom lacks the
// pieces — e.g. _getMapPanePos depends on offset properties — so it spits a
// stack instead of rendering.) The structural assertion ("the map slot is
// populated with the right trip/plan") is what this test cares about; the
// real leaflet rendering is exercised by the browser smoke in Step 9.
vi.mock("@/features/trip-planner/components/trip-map", () => ({
  default: ({ trip, plan }: { trip: { id: string }; plan: { trip_id: string } }) => (
    <div data-testid="trip-map" data-trip-id={trip.id} data-plan-trip-id={plan.trip_id}>
      Trip map ready
    </div>
  ),
}));

const { TripsDetailRoute } = await import("@/app/routes/trips-detail");

describe("TripsDetailRoute (main view)", () => {
  it("renders the lazy TripMap when both trip and plan resolve", async () => {
    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByTestId("trip-map")).toBeInTheDocument();
    });
    expect(screen.getByTestId("trip-map").dataset.tripId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByTestId("trip-map").dataset.planTripId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByText("Trip map ready")).toBeInTheDocument();
  });

  it("shows the Trip-not-found Empty state with a 'plan a new trip' link when the trip is 404", async () => {
    server.use(
      http.get("http://localhost:8000/api/trips/:id/", () =>
        HttpResponse.json({ detail: "Trip not found.", errors: null }, { status: 404 }),
      ),
    );

    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/missing"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/trip not found/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /plan a new trip/i })).toBeInTheDocument();
  });

  it("shows the Trip-data-missing Empty state without a new-trip link when the plan is 404", async () => {
    server.use(
      http.get("http://localhost:8000/api/trips/:id/plan/", () =>
        HttpResponse.json({ detail: "Plan not found.", errors: null }, { status: 404 }),
      ),
    );

    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/no-plan"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/trip data missing/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /plan a new trip/i })).toBeNull();
  });
});
