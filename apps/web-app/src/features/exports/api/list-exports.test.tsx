import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "@/config/env";
import { useExportsList } from "@/features/exports/api/list-exports";
import { mockExportsListEmpty } from "@/testing/handlers";
import { server } from "@/testing/setup";

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-jwt") }),
}));

afterEach(() => {
  server.resetHandlers();
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useExportsList", () => {
  it("parses the default MSW envelope", async () => {
    const { result } = renderHook(() => useExportsList({ limit: 50, offset: 0 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.count).toBe(2);
    expect(result.current.data?.results[0]?.mode).toBe("multi-page");
  });

  it("returns an empty envelope when the BE has no rows", async () => {
    server.use(mockExportsListEmpty());

    const { result } = renderHook(() => useExportsList({ limit: 50, offset: 0 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.count).toBe(0);
    expect(result.current.data?.results).toEqual([]);
  });

  it("surfaces a schema-drift ApiError when the BE returns an unexpected shape", async () => {
    server.use(
      http.get(`${env.VITE_API_URL}/api/exports/`, () =>
        HttpResponse.json({ count: "nope", next: null, previous: null, results: [] }),
      ),
    );

    const { result } = renderHook(() => useExportsList({ limit: 50, offset: 0 }), { wrapper });

    // useExportsList retries once on ApiError(0) per its retry policy, so the
    // first failure is followed by a ~1s backoff before the second attempt
    // and the final isError=true. Bump the waitFor budget to cover both.
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );
  });
});
