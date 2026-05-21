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
  it("renders a nav-app-style heading (Origin → Destination + cycle hint)", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      // Heading: Richmond, VA → Newark, NJ (USA suffix stripped). The arrow
      // span is aria-hidden so the accessible name omits it; flex children
      // don't insert whitespace between siblings in the accessibility tree.
      expect(
        screen.getByRole("heading", { name: /Richmond, VA.*Newark, NJ/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/35\.0 h used · 70-hour/i)).toBeInTheDocument();
  });

  it("renders the Route SidebarGroup with mono distance · duration via RouteSummary", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/342\.7 mi · 5h 18m/)).toBeInTheDocument();
    });
  });

  it("renders the Stops SidebarGroup populated from the plan endpoint", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      // Default plan handler returns 2 stops (pickup at Fredericksburg + dropoff at Newark).
      expect(screen.getByRole("list", { name: /trip stops/i })).toBeInTheDocument();
    });
    // Start row + 2 plan stops + arrival row = 4 list items.
    const list = screen.getByRole("list", { name: /trip stops/i });
    expect(list.querySelectorAll("li")).toHaveLength(4);
    // Stop kinds match the plan envelope (Pickup + Dropoff buttons rendered).
    expect(screen.getByRole("button", { name: /pickup/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dropoff/i })).toBeInTheDocument();
  });
});
