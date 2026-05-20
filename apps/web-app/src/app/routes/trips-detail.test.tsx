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

const { TripsDetailRoute } = await import("@/app/routes/trips-detail");

describe("TripsDetailRoute (main view)", () => {
  it("shows the not-found Empty state when the API returns 404", async () => {
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
});
