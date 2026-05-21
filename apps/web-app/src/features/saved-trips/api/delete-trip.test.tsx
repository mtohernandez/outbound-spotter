import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { server } from "@/testing/setup";

import type { ReactNode } from "react";

const clerk = buildClerkMocks();

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const { useDeleteTrip } = await import("@/features/saved-trips/api/delete-trip");

const BASE = "http://localhost:8000";
const TRIP_ID = "00000000-0000-4000-8000-000000000a01";

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

describe("useDeleteTrip", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("resolves and toasts success on a 204 response", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteTrip(), { wrapper });

    result.current.mutate({ id: TRIP_ID });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Trip deleted");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("invalidates the trips list query on success", async () => {
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteTrip(), { wrapper });

    result.current.mutate({ id: TRIP_ID });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["trips", "list"] });
  });

  it("toasts an error and does not invalidate when the server returns 404", async () => {
    server.use(
      http.delete(`${BASE}/api/trips/:id/`, () =>
        HttpResponse.json({ detail: "Trip not found." }, { status: 404 }),
      ),
    );
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteTrip(), { wrapper });

    result.current.mutate({ id: TRIP_ID });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(toastError).toHaveBeenCalledWith("Couldn't delete trip", { description: "delete-trip" });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
