import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/config/env";
import { RecreateExportButton } from "@/features/exports/components/recreate-export-button";
import type { SavedExport } from "@/features/exports/schemas/saved-export";
import { server } from "@/testing/setup";

const renderTripPdfMock =
  vi.fn<(input: { days: readonly unknown[]; mode: string }) => Promise<Blob>>();

vi.mock("@/features/pdf-export/lib/render-trip-pdf", () => ({
  renderTripPdf: (input: { days: readonly unknown[]; mode: string }) => renderTripPdfMock(input),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-jwt") }),
  useUser: () => ({ user: { fullName: "Jane Driver", firstName: "Jane", lastName: "Driver" } }),
}));

const toastError = vi.fn<(message: string) => void>();
const toastSuccess = vi.fn<(message: string) => void>();

vi.mock("sonner", () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    success: (message: string) => {
      toastSuccess(message);
    },
  },
}));

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test-url"),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  renderTripPdfMock.mockResolvedValue(new Blob(["%PDF-stub"], { type: "application/pdf" }));
});

afterEach(() => {
  renderTripPdfMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  server.resetHandlers();
  document.body.innerHTML = "";
});

const LIVE_RECORD: SavedExport = {
  id: "00000000-0000-4000-8000-0000000004a1",
  trip_id: "00000000-0000-4000-8000-000000000001",
  mode: "multi-page",
  sheet_count: 1,
  trip_current_label: "Richmond, VA",
  trip_pickup_label: "Fredericksburg, VA",
  trip_dropoff_label: "Newark, NJ",
  created_at: "2026-05-21T13:05:00Z",
};

const ORPHAN_RECORD: SavedExport = {
  ...LIVE_RECORD,
  id: "00000000-0000-4000-8000-0000000004a2",
  trip_id: null,
};

function renderButton(record: SavedExport) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RecreateExportButton record={record} />
    </QueryClientProvider>,
  );
}

describe("RecreateExportButton", () => {
  it("disables the button when trip_id is null (orphaned record)", () => {
    renderButton(ORPHAN_RECORD);

    const trigger = screen.getByRole("button", { name: /Re-download export/i });
    expect(trigger).toBeDisabled();
  });

  it("enables the button when the trip is live", () => {
    renderButton(LIVE_RECORD);

    const trigger = screen.getByRole("button", { name: /Re-download export/i });
    expect(trigger).not.toBeDisabled();
  });

  it("surfaces a 404 toast and clears the pending state when the trip has been deleted server-side", async () => {
    server.use(
      http.get(`${env.VITE_API_URL}/api/trips/:id/`, () =>
        HttpResponse.json({ detail: "Trip not found." }, { status: 404 }),
      ),
      http.get(`${env.VITE_API_URL}/api/trips/:id/plan/`, () =>
        HttpResponse.json({ detail: "Plan not found." }, { status: 404 }),
      ),
    );

    renderButton(LIVE_RECORD);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Re-download export/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Original trip is no longer available"),
      );
    });
    expect(renderTripPdfMock).not.toHaveBeenCalled();
    // Button returns to enabled state after the error.
    expect(screen.getByRole("button", { name: /Re-download export/i })).not.toBeDisabled();
  });
});
