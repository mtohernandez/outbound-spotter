import { useAuth } from "@clerk/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  exportsListResponseSchema,
  type ExportsListResponse,
} from "@/features/exports/schemas/exports-list-response";
import { ApiError, apiFetch } from "@/lib/api-client";

export type { SavedExport } from "@/features/exports/schemas/saved-export";
export type { ExportsListResponse } from "@/features/exports/schemas/exports-list-response";

export interface ExportsListParams {
  readonly limit: number;
  readonly offset: number;
}

const ONE_MIN = 60_000;

// Skip retries on auth / not-found — burning the JWT verifier on 401 or
// hammering the API on 404 doesn't change the outcome. Matches the
// useTripList precedent.
const NO_RETRY_STATUSES = new Set([401, 403, 404]);

export function useExportsList(params: ExportsListParams): UseQueryResult<ExportsListResponse> {
  const { getToken } = useAuth();
  return useQuery<ExportsListResponse>({
    queryKey: ["exports", "list", params.limit, params.offset],
    staleTime: ONE_MIN,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false;
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) return false;
      return true;
    },
    queryFn: async () => {
      const token = await getToken();
      const search = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
      });
      const raw = await apiFetch<unknown>(`/api/exports/?${search.toString()}`, { token });
      const result = exportsListResponseSchema.safeParse(raw);
      if (!result.success) {
        throw new ApiError(0, {
          detail: "Exports list response shape unexpected",
          issues: result.error.issues,
        });
      }
      return result.data;
    },
  });
}
