import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { TripDetailPanel } = await import("@/features/trip-planner/components/trip-detail-panel");

describe("TripDetailPanel", () => {
  it("renders a nav-app heading (Origin → Destination + cycle hint)", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      // Heading: Richmond, VA → Newark, NJ (USA stripped; arrow aria-hidden).
      expect(
        screen.getByRole("heading", { name: /Richmond, VA.*Newark, NJ/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/35\.0 h used · 70-hour/i)).toBeInTheDocument();
  });

  it("renders ONE unified Route group containing the Stops timeline", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /trip stops/i })).toBeInTheDocument();
    });
    // Stops timeline contains Start + planner stops + Arrive plus drive-segment rows.
    expect(screen.getByRole("button", { name: /pickup/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dropoff/i })).toBeInTheDocument();
    // Departure (2:00 PM EDT) appears at least in the summary header + Start row.
    expect(screen.getAllByText(/2:00.*PM/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the trip distance + duration in the summary header (one source of truth)", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      // formatDuration(19080) → "5h 18m" + formatDistance(342.7) → "342.7 mi"
      expect(screen.getByText(/5h 18m/)).toBeInTheDocument();
    });
    expect(screen.getByText(/342\.7 mi/)).toBeInTheDocument();
  });
});
