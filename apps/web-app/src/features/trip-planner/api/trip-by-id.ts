import { useAuth } from "@clerk/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  tripResponseSchema,
  type TripResponse,
} from "@/features/trip-planner/schemas/trip-response";
import { apiFetch } from "@/lib/api-client";

export type { TripResponse } from "@/features/trip-planner/schemas/trip-response";

export function useTripById(id: string | undefined): UseQueryResult<TripResponse> {
  const { getToken } = useAuth();
  return useQuery<TripResponse>({
    queryKey: ["trip", id],
    enabled: id !== undefined,
    retry: false,
    queryFn: async () => {
      const token = await getToken();
      const raw = await apiFetch<unknown>(`/api/trips/${id ?? ""}/`, { token });
      return tripResponseSchema.parse(raw);
    },
  });
}
