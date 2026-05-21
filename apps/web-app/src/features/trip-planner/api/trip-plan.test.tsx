import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { buildClerkMocks } from "@/testing/clerk-mocks";
import { server } from "@/testing/setup";

import type { ReactNode } from "react";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

// Imported *after* the mock above so the hook captures our stubbed useAuth.
const { useTripPlan } = await import("@/features/trip-planner/api/trip-plan");

const TRIP_ID = "00000000-0000-4000-8000-000000000099";
const BASE = "http://localhost:8000";

function makeWrapper(): {
  wrapper: (props: { children: ReactNode }) => ReactNode;
  client: QueryClient;
} {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper: Wrapper, client };
}

describe("useTripPlan", () => {
  beforeEach(() => {
    // Default MSW handler in handlers.ts returns the canned plan for any id.
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("parses the plan envelope on success", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripPlan(TRIP_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const plan = result.current.data;
    expect(plan?.trip_id).toBe(TRIP_ID);
    expect(plan?.home_terminal_tz).toBe("America/New_York");
    expect(plan?.stops.length).toBeGreaterThan(0);
  });

  it("surfaces a 404 as an ApiError", async () => {
    server.use(
      http.get(`${BASE}/api/trips/:id/plan/`, () =>
        HttpResponse.json({ detail: "Trip not found." }, { status: 404 }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripPlan(TRIP_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ status: 404 });
  });

  it("does not retry on failure (retry: false)", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/api/trips/:id/plan/`, () => {
        callCount += 1;
        return HttpResponse.json({ detail: "Server error." }, { status: 500 });
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripPlan(TRIP_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(callCount).toBe(1);
  });

  it("surfaces a zod parse failure as an ApiError (spec decision 9)", async () => {
    server.use(
      http.get(`${BASE}/api/trips/:id/plan/`, () => HttpResponse.json({ malformed: true })),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripPlan(TRIP_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
    const err = result.current.error as ApiError;
    expect(err.body).toMatchObject({ detail: "Plan response shape unexpected" });
  });

  it("stays disabled while tripId is undefined", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTripPlan(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isPending).toBe(true);
  });
});
