import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedTrip } from "@/features/saved-trips/schemas/saved-trip";
import type { TripsListResponse } from "@/features/saved-trips/schemas/trips-list-response";
import { buildClerkMocks } from "@/testing/clerk-mocks";
import { server } from "@/testing/setup";

import type { ReactNode } from "react";

const clerk = buildClerkMocks();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const { SavedTripsTable } = await import("@/features/saved-trips/components/saved-trips-table");

const ROW_A: SavedTrip = {
  id: "00000000-0000-4000-8000-000000000a01",
  current_label: "Richmond, VA",
  pickup_label: "Fredericksburg, VA",
  dropoff_label: "Newark, NJ",
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
  days_count: 1,
  start_at: "2026-05-21T14:00:00-04:00",
  created_at: "2026-05-20T12:00:00Z",
};
const ROW_B: SavedTrip = {
  ...ROW_A,
  id: "00000000-0000-4000-8000-000000000a02",
  current_label: "Atlanta, GA",
  pickup_label: "Charlotte, NC",
  dropoff_label: "Boston, MA",
  route_summary: { distance_mi: 980.4, duration_s: 53400 },
  days_count: 3,
};

const THREE_ROW_ENVELOPE: TripsListResponse = {
  count: 3,
  next: null,
  previous: null,
  results: [ROW_A, ROW_B, { ...ROW_A, id: "00000000-0000-4000-8000-000000000a03" }],
};

const SIXTY_ROW_ENVELOPE: TripsListResponse = {
  count: 60,
  next: "http://localhost:8000/api/trips/?limit=50&offset=50",
  previous: null,
  results: [ROW_A],
};

function renderTable(children: ReactNode): void {
  // Routes sentinel so we can observe in-router navigation without mocking
  // react-router: clicking a row should swap the `/trips` outlet for the
  // `/trips/:id` sentinel.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  render(
    <MemoryRouter initialEntries={["/trips"]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/trips" element={children} />
          <Route path="/trips/:id" element={<div data-testid="trip-detail-sentinel" />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("SavedTripsTable", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("renders one row per fixture trip with route + distance + days + departs", () => {
    renderTable(
      <SavedTripsTable
        data={THREE_ROW_ENVELOPE}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    // Anchor per data row provides the navigation; the row's other cells
    // (Distance, Days, Departs) are sibling <td>s, not nested in the anchor.
    const anchors = screen.getAllByRole("link", { name: /Open trip/ });
    expect(anchors).toHaveLength(3);
    expect(within(anchors[0]!).getByText("Richmond, VA")).toBeInTheDocument();

    const dataRows = screen.getAllByRole("row").slice(1); // skip the header row
    expect(dataRows).toHaveLength(3);
    expect(within(dataRows[0]!).getByText("342.7 mi")).toBeInTheDocument();
    expect(within(dataRows[1]!).getByText(/^3/)).toBeInTheDocument(); // "3" + sr-only " days"
  });

  it("navigates to /trips/<id> on row click", async () => {
    const user = userEvent.setup();
    renderTable(
      <SavedTripsTable
        data={THREE_ROW_ENVELOPE}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole("link", { name: /Open trip/ });
    await user.click(rows[0]!);

    expect(screen.getByTestId("trip-detail-sentinel")).toBeInTheDocument();
  });

  it("does not navigate when the trash button inside a row is clicked", async () => {
    const user = userEvent.setup();
    renderTable(
      <SavedTripsTable
        data={THREE_ROW_ENVELOPE}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const trashes = screen.getAllByRole("button", { name: /Delete trip/ });
    await user.click(trashes[0]!);

    expect(screen.queryByTestId("trip-detail-sentinel")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("renders the empty state when results is empty and not loading", () => {
    renderTable(
      <SavedTripsTable
        data={{ count: 0, next: null, previous: null, results: [] }}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("No saved trips yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the error state with a Retry button that fires onRetry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderTable(
      <SavedTripsTable
        data={undefined}
        isLoading={false}
        isError={true}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Couldn.+t load trips\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders skeleton rows while loading without showing the empty state", () => {
    renderTable(
      <SavedTripsTable
        data={undefined}
        isLoading={true}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByText("No saved trips yet.")).not.toBeInTheDocument();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("disables Next when on the last page and enables it on page 1 of 2", async () => {
    const onPaginationChange = vi.fn();
    const user = userEvent.setup();
    renderTable(
      <SavedTripsTable
        data={SIXTY_ROW_ENVELOPE}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 50 }}
        onPaginationChange={onPaginationChange}
        onRetry={vi.fn()}
      />,
    );

    const next = screen.getByRole("button", { name: "Next page" });
    const prev = screen.getByRole("button", { name: "Previous page" });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
    await user.click(next);
    expect(onPaginationChange).toHaveBeenCalled();
    const call = onPaginationChange.mock.calls[0]?.[0] as { pageIndex: number };
    expect(call.pageIndex).toBe(1);
  });
});
