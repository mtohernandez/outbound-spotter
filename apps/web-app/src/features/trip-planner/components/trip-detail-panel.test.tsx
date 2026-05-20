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

  it("renders the Route SidebarGroup with mono distance · duration", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/abc-id"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/342\.7 mi · 5h 18m/)).toBeInTheDocument();
    });
  });

  it("renders a Departs line in the Route SidebarGroup formatted in America/New_York", async () => {
    renderWithProviders(<TripDetailPanel />, {
      initialEntries: ["/trips/abc-id"],
      routePath: "/trips/:id",
    });

    await waitFor(() => {
      expect(screen.getByText(/Departs/)).toBeInTheDocument();
    });
    // MSW handler emits 2026-05-21T14:00:00-04:00 → 2:00 PM EDT (May = DST).
    expect(screen.getByText(/2:00/)).toBeInTheDocument();
    expect(screen.getByText(/May 21, 2026/)).toBeInTheDocument();
  });
});
