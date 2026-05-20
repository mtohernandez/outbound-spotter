import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { mockTripFailed, mockTripPlanning } from "@/testing/handlers";
import { renderWithProviders } from "@/testing/render";
import { server } from "@/testing/setup";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { TripDetailPanel } = await import("@/features/trip-planner/components/trip-detail-panel");

describe("TripDetailPanel", () => {
  it("renders the three resolved addresses + cycle hours for a planned trip", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/abc-id"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/Richmond, VA/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Fredericksburg, VA/i)).toBeInTheDocument();
    expect(screen.getByText(/Newark, NJ/i)).toBeInTheDocument();
    expect(screen.getByText(/35\.0 h of 70 h/i)).toBeInTheDocument();
  });

  it("renders the Route SidebarGroup with a Planned badge and mono distance for a planned trip", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/abc-id"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/^Planned$/)).toBeInTheDocument();
    });
    expect(screen.getByText(/342\.7 mi · 5h 18m/)).toBeInTheDocument();
  });

  it("renders a destructive Failed badge and a dash-line metric for a failed trip", async () => {
    server.use(mockTripFailed("upstream"));

    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/abc-id"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      const badge = screen.getByText(/^Failed$/);
      expect(badge).toBeInTheDocument();
      expect(badge.getAttribute("data-variant")).toBe("destructive");
    });
    expect(screen.getByText(/— · —/)).toBeInTheDocument();
  });

  it("renders a secondary Planning badge and a dash-line metric for a planning trip", async () => {
    server.use(mockTripPlanning());

    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/abc-id"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      const badge = screen.getByText(/^Planning$/);
      expect(badge).toBeInTheDocument();
      expect(badge.getAttribute("data-variant")).toBe("secondary");
    });
    expect(screen.getByText(/— · —/)).toBeInTheDocument();
  });
});
