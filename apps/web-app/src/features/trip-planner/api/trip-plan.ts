import { useAuth } from "@clerk/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { tripPlanSchema, type TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import { ApiError, apiFetch } from "@/lib/api-client";

export type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";

// Spec-06 guarantees the plan is immutable post-create; aggressive caching is
// correct. 4xx is deterministic (404 = missing trip, 401 = signed out); retrying
// only burns the trip_plan_retrieve throttle (120/min, per spec-06 decision 10).
const FIVE_MIN = 5 * 60_000;

export function useTripPlan(tripId: string | undefined): UseQueryResult<TripPlan> {
  const { getToken } = useAuth();
  return useQuery<TripPlan>({
    queryKey: ["trip", tripId, "plan"],
    enabled: tripId !== undefined,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const token = await getToken();
      const raw = await apiFetch<unknown>(`/api/trips/${tripId ?? ""}/plan/`, { token });
      const result = tripPlanSchema.safeParse(raw);
      if (!result.success) {
        // Surface schema drift as an ApiError so observability tooling can
        // distinguish it from network/HTTP failures (spec decision 9).
        throw new ApiError(0, {
          detail: "Plan response shape unexpected",
          issues: result.error.issues,
        });
      }
      return result.data;
    },
  });
}
