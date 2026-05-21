import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "@/config/env";
import { useCreateExportRecord } from "@/features/exports/api/create-export";
import { server } from "@/testing/setup";

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-jwt") }),
}));

afterEach(() => {
  server.resetHandlers();
});

const TRIP_ID = "00000000-0000-4000-8000-000000000001";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCreateExportRecord", () => {
  it("posts the kebab-case mode to /api/exports/ and parses the response", async () => {
    let received: unknown;
    server.use(
      http.post(`${env.VITE_API_URL}/api/exports/`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          {
            id: "00000000-0000-4000-8000-0000000004ff",
            trip_id: TRIP_ID,
            mode: "single-page",
            sheet_count: 2,
            trip_current_label: "Richmond, VA",
            trip_pickup_label: "Fredericksburg, VA",
            trip_dropoff_label: "Newark, NJ",
            created_at: "2026-05-21T13:05:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateExportRecord(), { wrapper });

    result.current.mutate({ trip_id: TRIP_ID, mode: "single-page" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(received).toEqual({ trip_id: TRIP_ID, mode: "single-page" });
    expect(result.current.data?.mode).toBe("single-page");
  });

  it("surfaces an error on 4xx", async () => {
    server.use(
      http.post(`${env.VITE_API_URL}/api/exports/`, () =>
        HttpResponse.json({ detail: "Trip not found." }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useCreateExportRecord(), { wrapper });

    result.current.mutate({ trip_id: TRIP_ID, mode: "multi-page" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
