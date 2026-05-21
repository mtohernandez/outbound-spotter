import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { MULTI_DAY_PLAN_OVERRIDES } from "@/testing/handlers";
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

describe("TripsDetailRoute (Tabs wrap)", () => {
  it("defaults to the Map tab when no ?view= search param is present", async () => {
    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^Map$/ })).toHaveAttribute("data-state", "active");
    });
    expect(screen.getByRole("tab", { name: /Log sheets/i })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    // Both panels mounted simultaneously (Radix forceMount + CSS hiding).
    await waitFor(() => {
      expect(screen.getByTestId("trip-map")).toBeInTheDocument();
    });
  });

  it("opens the Log sheets tab on mount when ?view=logs", async () => {
    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001?view=logs"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Log sheets/i })).toHaveAttribute(
        "data-state",
        "active",
      );
    });
    expect(screen.getByRole("tab", { name: /^Map$/ })).toHaveAttribute("data-state", "inactive");
  });

  it("preserves both Map and Log-sheet state when toggling tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByTestId("trip-map")).toBeInTheDocument();
    });

    // Switch to Log sheets — the stub map remains mounted (forceMount), the
    // log strip becomes active.
    await user.click(screen.getByRole("tab", { name: /Log sheets/i }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Log sheets/i })).toHaveAttribute(
        "data-state",
        "active",
      );
    });
    // forceMount keeps Map's stub in the DOM even when hidden.
    expect(screen.queryByTestId("trip-map")).not.toBeNull();
    expect(document.querySelector("[data-slot='daily-log-sheets-strip']")).not.toBeNull();

    // Type into the truck# input on the active sheet.
    const truckInputs = screen.getAllByLabelText("Truck or Tractor number");
    expect(truckInputs.length).toBeGreaterThanOrEqual(1);
    await user.type(truckInputs[0]!, "T-99");
    expect(truckInputs[0]).toHaveValue("T-99");

    // Switch back to Map, then back to Log sheets — input state must persist.
    await user.click(screen.getByRole("tab", { name: /^Map$/ }));
    await user.click(screen.getByRole("tab", { name: /Log sheets/i }));
    const truckInputsAfter = screen.getAllByLabelText("Truck or Tractor number");
    expect(truckInputsAfter[0]).toHaveValue("T-99");
  });

  it("renders one Daily Log Sheet per day in a multi-day plan", async () => {
    server.use(
      http.get("http://localhost:8000/api/trips/:id/plan/", ({ params }) =>
        HttpResponse.json({
          trip_id: String(params.id),
          start_at: "2026-05-21T14:00:00-07:00",
          home_terminal_tz: "America/Los_Angeles",
          stops: MULTI_DAY_PLAN_OVERRIDES.stops,
          events: MULTI_DAY_PLAN_OVERRIDES.events,
          days: MULTI_DAY_PLAN_OVERRIDES.days,
        }),
      ),
    );

    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001?view=logs"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Log sheets/i })).toHaveAttribute(
        "data-state",
        "active",
      );
    });
    await waitFor(() => {
      expect(document.querySelectorAll("[data-slot='daily-log-sheet']")).toHaveLength(3);
    });
  });

  it("mounts the Export PDF trigger in the TabsList trailing area", async () => {
    renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    const trigger = await screen.findByTestId("export-pdf-trigger");
    expect(trigger).toHaveTextContent(/export pdf/i);
    expect(trigger).not.toBeDisabled();
  });

  it("hides the Export PDF trigger when the trip 404s", async () => {
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
    // The Export button is only rendered inside the Tabs wrap, which the
    // Empty state replaces. Verify it never paints.
    expect(screen.queryByTestId("export-pdf-trigger")).toBeNull();
  });

  it("still shows the Trip-not-found Empty state when the trip is 404", async () => {
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

  it("still shows the Trip-data-missing Empty state when the plan is 404", async () => {
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
