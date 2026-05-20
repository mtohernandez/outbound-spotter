import { useAuth } from "@clerk/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { paths } from "@/config/paths";
import type { TripInput } from "@/features/trip-planner/schemas/trip-input";
import { ApiError, apiFetch } from "@/lib/api-client";

interface TripCreateResponse {
  readonly id: string;
  readonly status: string;
  readonly created_at: string;
}

function toWirePayload(input: TripInput): Record<string, unknown> {
  return {
    current: pickAddress(input.current),
    pickup: pickAddress(input.pickup),
    dropoff: pickAddress(input.dropoff),
    cycle_hours_used: input.cycleHoursUsed.toFixed(1),
  };
}

function pickAddress(address: TripInput["current"]): Record<string, unknown> {
  return {
    label: address.label,
    lat: address.lat,
    lon: address.lon,
    confidence: address.confidence,
  };
}

export function usePlanTrip(): UseMutationResult<TripCreateResponse, Error, TripInput> {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  return useMutation<TripCreateResponse, Error, TripInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      return apiFetch<TripCreateResponse>("/api/trips/", {
        method: "POST",
        token,
        json: toWirePayload(input),
      });
    },
    onSuccess: (data) => {
      void navigate(paths.tripsDetail(data.id));
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `Couldn't save trip (HTTP ${String(error.status)})`
          : error.message;
      toast.error(message);
    },
  });
}
