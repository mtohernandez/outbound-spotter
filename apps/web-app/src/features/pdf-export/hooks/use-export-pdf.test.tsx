import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExportPdf } from "@/features/pdf-export/hooks/use-export-pdf";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

const renderTripPdfMock =
  vi.fn<(input: { days: readonly LogDay[]; mode: string }) => Promise<Blob>>();

interface CreateMutateOptions {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

const createMutationState = {
  mutate:
    vi.fn<(input: { trip_id: string; mode: string }, options?: CreateMutateOptions) => void>(),
  shouldFail: false as boolean | Error,
};

vi.mock("@/features/pdf-export/lib/render-trip-pdf", () => ({
  renderTripPdf: (input: { days: readonly LogDay[]; mode: string }) => renderTripPdfMock(input),
}));

vi.mock("@/features/exports/api/create-export", () => ({
  useCreateExportRecord: () => ({
    mutate: (input: { trip_id: string; mode: string }, options?: CreateMutateOptions) => {
      createMutationState.mutate(input, options);
      const failure = createMutationState.shouldFail;
      if (failure !== false) {
        options?.onError?.(failure instanceof Error ? failure : new Error("create failed"));
      } else {
        options?.onSuccess?.();
      }
    },
  }),
}));

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL; stub both so
// the download-trigger path doesn't blow up under test.
beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test-url"),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  renderTripPdfMock.mockResolvedValue(new Blob(["%PDF-stub"], { type: "application/pdf" }));
  createMutationState.mutate.mockReset();
  createMutationState.shouldFail = false;
});

afterEach(() => {
  renderTripPdfMock.mockReset();
  document.body.innerHTML = "";
});

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

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useExportPdf", () => {
  it("flips isPending while the orchestrator runs", async () => {
    let resolveRender: (value: Blob) => void = () => undefined;
    renderTripPdfMock.mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolveRender = resolve;
        }),
    );

    const { result } = renderHook(() => useExportPdf({ tripId: TRIP_ID, days: [DAY] }), {
      wrapper,
    });

    expect(result.current.isPending).toBe(false);
    void result.current.exportPdf("multi-page");

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    resolveRender(new Blob(["%PDF-ok"], { type: "application/pdf" }));

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("renders the PDF and fires the audit-record mutation with the chosen mode", async () => {
    const { result } = renderHook(() => useExportPdf({ tripId: TRIP_ID, days: [DAY] }), {
      wrapper,
    });

    await result.current.exportPdf("single-page");

    expect(renderTripPdfMock).toHaveBeenCalledWith({ days: [DAY], mode: "single-page" });
    expect(createMutationState.mutate).toHaveBeenCalledTimes(1);
    expect(createMutationState.mutate.mock.calls[0]?.[0]).toEqual({
      trip_id: TRIP_ID,
      mode: "single-page",
    });
  });

  it("does NOT surface a toast or error when the audit-record mutation fails", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createMutationState.shouldFail = new Error("network down");

    const { result } = renderHook(() => useExportPdf({ tripId: TRIP_ID, days: [DAY] }), {
      wrapper,
    });

    await result.current.exportPdf("multi-page");

    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();

    consoleWarn.mockRestore();
  });

  it("sets `error` and rethrows when the orchestrator itself fails", async () => {
    renderTripPdfMock.mockRejectedValueOnce(new Error("svg2pdf failed"));

    const { result } = renderHook(() => useExportPdf({ tripId: TRIP_ID, days: [DAY] }), {
      wrapper,
    });

    await expect(result.current.exportPdf("multi-page")).rejects.toThrow(/svg2pdf failed/);
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toBe("svg2pdf failed");
    // Mutation should never fire when the PDF rendering itself failed.
    expect(createMutationState.mutate).not.toHaveBeenCalled();
  });
});
