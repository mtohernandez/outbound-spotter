import { useAuth } from "@clerk/react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export interface GeocodeFeature {
  readonly label: string;
  readonly country_a: string | null;
  readonly region_a: string | null;
  readonly locality: string | null;
  readonly confidence: number | null;
  readonly match_type: string | null;
  readonly lat: number;
  readonly lon: number;
}

interface AutocompleteResponse {
  readonly features: readonly GeocodeFeature[];
}

const MIN_QUERY_LENGTH = 3;
const STALE_TIME_MS = 5 * 60 * 1000;

export function useGeocodeAutocomplete(text: string): UseQueryResult<readonly GeocodeFeature[]> {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["geocode", "autocomplete", text],
    enabled: text.length >= MIN_QUERY_LENGTH,
    staleTime: STALE_TIME_MS,
    queryFn: async (): Promise<readonly GeocodeFeature[]> => {
      const token = await getToken();
      const params = new URLSearchParams({ text });
      const result = await apiFetch<AutocompleteResponse>(
        `/api/geocode/autocomplete/?${params.toString()}`,
        { token },
      );
      return result.features;
    },
  });
}
