import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { mockExportsList, mockExportsListEmpty } from "@/testing/handlers";
import { renderWithProviders } from "@/testing/render";
import { server } from "@/testing/setup";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { ExportsHistoryRoute } = await import("@/app/routes/exports-history");

describe("ExportsHistoryRoute", () => {
  it("renders the heading + populated table on the default fixture", async () => {
    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });

    expect(await screen.findByRole("heading", { name: /Exports/ })).toBeInTheDocument();
    // Two rows in the default fixture: a live trip + an orphaned (Deleted) one.
    await waitFor(() => {
      expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(3); // header + 2 rows
    });
    expect(screen.getByText(/Multi-page/)).toBeInTheDocument();
    expect(screen.getByText(/Single-page/)).toBeInTheDocument();
  });

  it("shows the empty state when no exports exist", async () => {
    server.use(mockExportsListEmpty());

    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });

    expect(await screen.findByText(/No exports yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse saved trips/i })).toBeInTheDocument();
  });

  it("renders the trip route as a link when the trip is still alive", async () => {
    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });

    const link = await screen.findByRole("link", {
      name: /Open trip Richmond, VA to Newark, NJ/i,
    });
    expect(link).toHaveAttribute("href", "/trips/00000000-0000-4000-8000-000000000001");
  });

  it("renders the trip route as inert text with a Deleted badge when trip_id is null", async () => {
    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });

    await waitFor(() => {
      expect(screen.getByText(/Deleted/i)).toBeInTheDocument();
    });
    // No link for the LA → Albuquerque orphan row.
    expect(screen.queryByRole("link", { name: /Los Angeles, CA to Albuquerque, NM/i })).toBeNull();
  });

  it("disables the Recreate button when trip_id is null (graceful degradation)", async () => {
    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });

    const recreateButtons = await screen.findAllByRole("button", { name: /Re-download export/i });
    // First row (live trip) is enabled; second row (orphan) is disabled.
    expect(recreateButtons[0]).not.toBeDisabled();
    expect(recreateButtons[1]).toBeDisabled();
  });

  it("opens the delete dialog when the trash icon is clicked", async () => {
    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });
    const user = userEvent.setup();

    const deleteButtons = await screen.findAllByRole("button", { name: /Remove export record/i });
    await user.click(deleteButtons[0]!);

    expect(
      await screen.findByRole("alertdialog", { name: /Remove this export from history/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/PDF on disk is unaffected/i)).toBeInTheDocument();
  });

  it("paginates when count > pageSize", async () => {
    // 75 rows so a 50-per-page split produces two pages.
    const rows = Array.from({ length: 75 }, (_, idx) => ({
      id: `00000000-0000-4000-8000-${idx.toString().padStart(12, "0")}`,
      trip_id: "00000000-0000-4000-8000-000000000001",
      mode: "multi-page" as const,
      sheet_count: 2,
      trip_current_label: "Richmond, VA",
      trip_pickup_label: "Fredericksburg, VA",
      trip_dropoff_label: "Newark, NJ",
      created_at: "2026-05-21T13:05:00Z",
    }));
    server.use(mockExportsList(rows));

    renderWithProviders(<ExportsHistoryRoute />, {
      initialEntries: ["/exports"],
      routePath: "/exports",
    });

    expect(await screen.findByText(/Page 1 of 2/)).toBeInTheDocument();
  });
});
