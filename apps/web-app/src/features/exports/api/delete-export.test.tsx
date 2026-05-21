import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "@/config/env";
import { useDeleteExportRecord } from "@/features/exports/api/delete-export";
import { server } from "@/testing/setup";

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-jwt") }),
}));

const toastSuccess = vi.fn<(message: string) => void>();
const toastError = vi.fn<(message: string) => void>();

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => {
      toastSuccess(message);
    },
    error: (message: string) => {
      toastError(message);
    },
  },
}));

afterEach(() => {
  server.resetHandlers();
  toastSuccess.mockReset();
  toastError.mockReset();
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeleteExportRecord", () => {
  it("DELETEs the audit row and toasts on success", async () => {
    const { result } = renderHook(() => useDeleteExportRecord(), { wrapper });

    result.current.mutate({ id: "00000000-0000-4000-8000-0000000004a1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Removed from history");
  });

  it("toasts an error on failure", async () => {
    server.use(
      http.delete(`${env.VITE_API_URL}/api/exports/:id/`, () =>
        HttpResponse.json({ detail: "Not found" }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useDeleteExportRecord(), { wrapper });

    result.current.mutate({ id: "00000000-0000-4000-8000-0000000004a1" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(toastError).toHaveBeenCalled();
  });
});
