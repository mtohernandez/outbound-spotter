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

export function useTripList(params: TripListParams): UseQueryResult<TripsListResponse> {
  const { getToken } = useAuth();
  return useQuery<TripsListResponse>({
    // Params live in the key so each (limit, offset) tuple caches separately;
    // a prefix-match invalidation on ["trips","list"] still clears every page.
    queryKey: ["trips", "list", params],
    staleTime: ONE_MIN,
    refetchOnWindowFocus: false,
    retry: 1,
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
