import { z } from "zod";

// Mirrors web_api/apps/trips/serializers.py::TripListItemSerializer.
// `route_summary` is re-declared inline (vs. importing from trip-planner) so
// the saved-trips schema stays self-contained — the shape is two numbers, the
// duplication is cheaper than a cross-feature dep just for typing.
export const routeSummarySchema = z.object({
  distance_mi: z.number(),
  duration_s: z.number().int(),
});

export const savedTripSchema = z.object({
  id: z.uuid(),
  current_label: z.string(),
  pickup_label: z.string(),
  dropoff_label: z.string(),
  route_summary: routeSummarySchema,
  days_count: z.number().int().nonnegative(),
  start_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }),
});

export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type SavedTrip = z.infer<typeof savedTripSchema>;
