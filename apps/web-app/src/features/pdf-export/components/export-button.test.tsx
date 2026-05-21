import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExportButton } from "@/features/pdf-export/components/export-button";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";
import { renderWithProviders } from "@/testing/render";

vi.mock("@/features/pdf-export/hooks/use-export-pdf", () => ({
  useExportPdf: () => ({
    exportPdf: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    error: null,
  }),
}));

const DAY: LogDay = {
  id: "00000000-0000-4000-8000-000000000301",
  date: "2026-05-21",
  off_duty_s: 0,
  sleeper_s: 0,
  driving_s: 30_000,
  on_duty_not_driving_s: 0,
  total_miles: 200,
};

const TRIP_ID = "abcd1234-aaaa-bbbb-cccc-dddddddddddd";

describe("ExportButton", () => {
  it("renders as an outline button with the FileDown icon", () => {
    renderWithProviders(<ExportButton tripId={TRIP_ID} days={[DAY]} />);

    const trigger = screen.getByTestId("export-pdf-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/export pdf/i);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens the dialog on click", async () => {
    renderWithProviders(<ExportButton tripId={TRIP_ID} days={[DAY]} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("export-pdf-trigger"));

    expect(screen.getByRole("heading", { name: /export pdf/i })).toBeInTheDocument();
  });

  it("reflects the dialog state via aria-expanded", async () => {
    renderWithProviders(<ExportButton tripId={TRIP_ID} days={[DAY]} />);
    const user = userEvent.setup();
    const trigger = screen.getByTestId("export-pdf-trigger");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("is disabled when explicitly disabled", () => {
    renderWithProviders(<ExportButton tripId={TRIP_ID} days={[DAY]} disabled />);

    expect(screen.getByTestId("export-pdf-trigger")).toBeDisabled();
  });

  it("is disabled when the trip has no log days", () => {
    renderWithProviders(<ExportButton tripId={TRIP_ID} days={[]} />);

    expect(screen.getByTestId("export-pdf-trigger")).toBeDisabled();
  });
});
