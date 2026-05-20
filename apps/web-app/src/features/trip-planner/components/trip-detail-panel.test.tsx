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
  it("renders the three resolved addresses + cycle hours for an existing trip", async () => {
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
});
