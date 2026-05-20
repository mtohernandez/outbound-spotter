import { useAuth } from "@clerk/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export interface TripResponse {
  readonly id: string;
  readonly status: string;
  readonly created_at: string;
  readonly current_label: string;
  readonly current_lat: number;
  readonly current_lon: number;
  readonly pickup_label: string;
  readonly pickup_lat: number;
  readonly pickup_lon: number;
  readonly dropoff_label: string;
  readonly dropoff_lat: number;
  readonly dropoff_lon: number;
  readonly cycle_hours_used: string;
}

export function useTripById(id: string | undefined): UseQueryResult<TripResponse> {
  const { getToken } = useAuth();
  return useQuery<TripResponse>({
    queryKey: ["trip", id],
    enabled: id !== undefined,
    retry: false,
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<TripResponse>(`/api/trips/${id ?? ""}/`, { token });
    },
  });
}
