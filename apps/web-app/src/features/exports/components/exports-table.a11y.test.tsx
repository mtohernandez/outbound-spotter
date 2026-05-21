import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import type { SavedExport } from "@/features/exports/schemas/saved-export";
import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { ExportsTable } = await import("@/features/exports/components/exports-table");

function makeExport(id: string): SavedExport {
  return {
    id,
    trip_id: "00000000-0000-4000-8000-000000000001",
    mode: "multi-page",
    sheet_count: 2,
    trip_current_label: "Richmond, VA",
    trip_pickup_label: "Fredericksburg, VA",
    trip_dropoff_label: "Newark, NJ",
    created_at: "2026-05-21T13:05:00Z",
  };
}

describe("ExportsTable — a11y", () => {
  it("renders a populated table without axe-detectable accessibility violations", async () => {
    const { container } = renderWithProviders(
      <ExportsTable
        data={{
          count: 2,
          next: null,
          previous: null,
          results: [makeExport("export-1"), makeExport("export-2")],
        }}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={() => undefined}
        onRetry={() => undefined}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders the empty state without axe violations", async () => {
    const { container } = renderWithProviders(
      <ExportsTable
        data={{ count: 0, next: null, previous: null, results: [] }}
        isLoading={false}
        isError={false}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={() => undefined}
        onRetry={() => undefined}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
