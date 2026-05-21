import { waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

vi.mock("@/features/trip-planner/components/trip-map", () => ({
  default: () => <div data-testid="trip-map">Trip map</div>,
}));

const { TripsDetailRoute } = await import("@/app/routes/trips-detail");

describe("TripsDetailRoute — a11y", () => {
  it("renders the loaded trip detail without axe-detectable violations", async () => {
    const { container } = renderWithProviders(<TripsDetailRoute />, {
      initialEntries: ["/trips/00000000-0000-4000-8000-000000000001"],
      routePath: "/trips/:id",
    });

    // Wait for the MSW-backed trip + plan queries to settle so the
    // AssumptionsBanner, Tabs, Map+Logs panels, and PlanningDisclaimer all
    // render before axe runs.
    await waitFor(() => {
      expect(container.querySelector('[role="tab"]')).not.toBeNull();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
