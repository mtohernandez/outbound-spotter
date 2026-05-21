import { useAuth } from "@clerk/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  tripsListResponseSchema,
  type TripsListResponse,
} from "@/features/saved-trips/schemas/trips-list-response";
import { ApiError, apiFetch } from "@/lib/api-client";

export type { SavedTrip } from "@/features/saved-trips/schemas/saved-trip";
export type { TripsListResponse } from "@/features/saved-trips/schemas/trips-list-response";

export interface TripListParams {
  readonly limit: number;
  readonly offset: number;
}

const ONE_MIN = 60_000;

// Skip retries on auth + not-found errors — retrying a 401 burns the JWT
// verifier without changing the outcome (code-reviewer M2). Network 5xx still
// gets one retry.
const NO_RETRY_STATUSES = new Set([401, 403, 404]);

export function useTripList(params: TripListParams): UseQueryResult<TripsListResponse> {
  const { getToken } = useAuth();
  return useQuery<TripsListResponse>({
    // Primitive key parts (typescript-pro M1) — each (limit, offset) tuple
    // caches separately; prefix invalidation on ["trips","list"] still
    // clears every page.
    queryKey: ["trips", "list", params.limit, params.offset],
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
      const raw = await apiFetch<unknown>(`/api/trips/?${search.toString()}`, { token });
      const result = tripsListResponseSchema.safeParse(raw);
      if (!result.success) {
        throw new ApiError(0, {
          detail: "Trips list response shape unexpected",
          issues: result.error.issues,
        });
      }
      return result.data;
    },
  });
}
