import { useAuth } from "@clerk/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import type { GeocodeFeature } from "@/features/trip-planner/api/geocode-autocomplete";
import { apiFetch } from "@/lib/api-client";

interface ReverseResponse {
  readonly features: readonly GeocodeFeature[];
}

export interface ReverseGeocodeInput {
  readonly lat: number;
  readonly lon: number;
}

export class ReverseGeocodeEmptyError extends Error {
  constructor() {
    super("No address found for those coordinates.");
    this.name = "ReverseGeocodeEmptyError";
  }
}

export function useReverseGeocode(): UseMutationResult<GeocodeFeature, Error, ReverseGeocodeInput> {
  const { getToken } = useAuth();

  return useMutation<GeocodeFeature, Error, ReverseGeocodeInput>({
    mutationFn: async ({ lat, lon }) => {
      const token = await getToken();
      // POST with JSON body — driver coordinates are PII and a GET would
      // put `?lat=&lon=` in proxy access logs. Spec 11 follow-up (security
      // MEDIUM-3).
      const result = await apiFetch<ReverseResponse>("/api/geocode/reverse/", {
        method: "POST",
        token,
        json: { lat, lon },
      });
      const first = result.features[0];
      if (first === undefined) {
        throw new ReverseGeocodeEmptyError();
      }
      return first;
    },
  });
}
