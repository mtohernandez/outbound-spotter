import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportDialog } from "@/features/pdf-export/components/export-dialog";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";
import { renderWithProviders } from "@/testing/render";

const exportPdfMock = vi.fn<(mode: "multi-page" | "single-page") => Promise<void>>();

vi.mock("@/features/pdf-export/hooks/use-export-pdf", () => ({
  useExportPdf: () => ({
    exportPdf: (mode: "multi-page" | "single-page") => exportPdfMock(mode),
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

function setupDialog(): { onOpenChange: ReturnType<typeof vi.fn> } {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  renderWithProviders(
    <ExportDialog tripId={TRIP_ID} days={[DAY]} open onOpenChange={onOpenChange} />,
  );
  return { onOpenChange };
}

beforeEach(() => {
  exportPdfMock.mockResolvedValue(undefined);
});

afterEach(() => {
  exportPdfMock.mockReset();
});

describe("ExportDialog", () => {
  it("renders with a title and description plus the two layout options", () => {
    setupDialog();

    expect(screen.getByRole("heading", { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/standard fonts/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /multi-page/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /single-page/i })).toBeInTheDocument();
  });

  it("defaults to multi-page when opened", () => {
    setupDialog();

    const multi = screen.getByRole("radio", { name: /multi-page/i });
    expect(multi).toHaveAttribute("data-state", "on");
  });

  it("invokes exportPdf with the selected mode on Export", async () => {
    const { onOpenChange } = setupDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: /single-page/i }));
    await user.click(screen.getByTestId("export-pdf-confirm"));

    await waitFor(() => {
      expect(exportPdfMock).toHaveBeenCalledWith("single-page");
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("closes via Cancel without invoking exportPdf", async () => {
    const { onOpenChange } = setupDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(exportPdfMock).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the dialog open when exportPdf rejects", async () => {
    exportPdfMock.mockRejectedValueOnce(new Error("nope"));
    const { onOpenChange } = setupDialog();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("export-pdf-confirm"));

    await waitFor(() => {
      expect(exportPdfMock).toHaveBeenCalled();
    });
    // onOpenChange(false) is only called on success; failure leaves it.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
