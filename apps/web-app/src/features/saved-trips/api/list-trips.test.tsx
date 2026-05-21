import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { buildClerkMocks } from "@/testing/clerk-mocks";
import { server } from "@/testing/setup";

import type { ReactNode } from "react";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { useTripList } = await import("@/features/saved-trips/api/list-trips");

const BASE = "http://localhost:8000";

function makeWrapper(): { wrapper: (props: { children: ReactNode }) => ReactNode } {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper: Wrapper };
}

describe("useTripList", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("parses the pagination envelope on success", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripList({ limit: 50, offset: 0 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.count).toBe(3);
    expect(result.current.data?.results).toHaveLength(3);
    expect(result.current.data?.results[0]?.current_label).toBe("Richmond, VA");
  });

  it("forwards limit + offset as query params", async () => {
    let observedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/api/trips/`, ({ request }) => {
        observedUrl = request.url;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripList({ limit: 10, offset: 20 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(observedUrl).toContain("limit=10");
    expect(observedUrl).toContain("offset=20");
  });

  it("surfaces a zod parse failure as an ApiError", async () => {
    server.use(http.get(`${BASE}/api/trips/`, () => HttpResponse.json({ malformed: true })));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripList({ limit: 50, offset: 0 }), { wrapper });

    // The hook is configured with retry: 1; TanStack's first retry delay is
    // ~1s, so allow up to 4s for the second failure to surface.
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 4000 },
    );
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).body).toMatchObject({
      detail: "Trips list response shape unexpected",
    });
  });

  it("surfaces a 401 as an ApiError after exhausting the retry budget", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/api/trips/`, () => {
        callCount += 1;
        return HttpResponse.json({ detail: "Unauthorized." }, { status: 401 });
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripList({ limit: 50, offset: 0 }), { wrapper });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 4000 },
    );
    // Hook configures retry: 1, so we expect 2 attempts before the error surfaces.
    expect(callCount).toBe(2);
    expect((result.current.error as ApiError).status).toBe(401);
  });
});
