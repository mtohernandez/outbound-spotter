import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/config/env";
import { useExportPdf } from "@/features/pdf-export/hooks/use-export-pdf";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";
import { server } from "@/testing/setup";

const renderTripPdfMock =
  vi.fn<(input: { days: readonly LogDay[]; mode: string }) => Promise<Blob>>();

vi.mock("@/features/pdf-export/lib/render-trip-pdf", () => ({
  renderTripPdf: (input: { days: readonly LogDay[]; mode: string }) => renderTripPdfMock(input),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({
    getToken: () => Promise.resolve("test-jwt"),
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

  it("renders the PDF and fires the audit-record POST after success", async () => {
    const recordedPayloads: unknown[] = [];
    server.use(
      http.post(`${env.VITE_API_URL}/api/exports/`, async ({ request }) => {
        const body = (await request.json()) as unknown;
        recordedPayloads.push(body);
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useExportPdf({ tripId: TRIP_ID, days: [DAY] }), {
      wrapper,
    });

    await result.current.exportPdf("single-page");

    expect(renderTripPdfMock).toHaveBeenCalledWith({ days: [DAY], mode: "single-page" });
    await waitFor(() => {
      expect(recordedPayloads).toHaveLength(1);
    });
    expect(recordedPayloads[0]).toEqual({ trip_id: TRIP_ID, mode: "single-page" });
  });

  it("does NOT show a toast or surface an error when the audit record fails", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    server.use(http.post(`${env.VITE_API_URL}/api/exports/`, () => HttpResponse.error()));

    const { result } = renderHook(() => useExportPdf({ tripId: TRIP_ID, days: [DAY] }), {
      wrapper,
    });

    await result.current.exportPdf("multi-page");
    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalled();
    });
    // The hook resolved cleanly (no thrown error); the PDF download succeeded.
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
  });
});
