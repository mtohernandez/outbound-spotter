import { useAuth } from "@clerk/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { paths } from "@/config/paths";
import type { TripInput } from "@/features/trip-planner/schemas/trip-input";
import {
  tripResponseSchema,
  type TripResponse,
} from "@/features/trip-planner/schemas/trip-response";
import { ApiError, apiFetch } from "@/lib/api-client";

function toWirePayload(input: TripInput): Record<string, unknown> {
  return {
    current: pickAddress(input.current),
    pickup: pickAddress(input.pickup),
    dropoff: pickAddress(input.dropoff),
    cycle_hours_used: input.cycleHoursUsed.toFixed(1),
    start_at: input.startAt,
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

function extractDetail(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body;
  if (body === null || typeof body !== "object") return null;
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.length > 0 ? detail : null;
}

export function usePlanTrip(): UseMutationResult<TripResponse, Error, TripInput> {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  return useMutation<TripResponse, Error, TripInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      const raw = await apiFetch<unknown>("/api/trips/", {
        method: "POST",
        token,
        json: toWirePayload(input),
      });
      return tripResponseSchema.parse(raw);
    },
    onSuccess: (data) => {
      void navigate(paths.tripsDetail(data.id));
    },
    onError: (error) => {
      const message = extractDetail(error) ?? error.message;
      toast.error(message);
    },
  });
}
