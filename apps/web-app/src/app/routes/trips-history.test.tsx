import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { mockSavedTripsListEmpty } from "@/testing/handlers";
import { renderWithProviders } from "@/testing/render";
import { server } from "@/testing/setup";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { TripsHistoryRoute } = await import("@/app/routes/trips-history");

const BASE = "http://localhost:8000";

describe("TripsHistoryRoute", () => {
  it("renders the page heading + the fixture trip rows", async () => {
    renderWithProviders(<TripsHistoryRoute />, { initialEntries: ["/trips"] });

    expect(screen.getByRole("heading", { level: 1, name: "Saved trips" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Open trip/ })).toHaveLength(3);
    });
  });

  it("renders the empty state when the list is empty", async () => {
    server.use(mockSavedTripsListEmpty());
    renderWithProviders(<TripsHistoryRoute />, { initialEntries: ["/trips"] });

    await waitFor(() => {
      expect(screen.getByText("No saved trips yet.")).toBeInTheDocument();
    });
  });

  it("renders the error state when the list endpoint returns 500", async () => {
    server.use(
      http.get(`${BASE}/api/trips/`, () =>
        HttpResponse.json({ detail: "Server error." }, { status: 500 }),
      ),
    );
    renderWithProviders(<TripsHistoryRoute />, { initialEntries: ["/trips"] });

    await waitFor(
      () => {
        expect(screen.getByText(/Couldn.+t load trips\./)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
