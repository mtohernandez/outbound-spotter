import { z } from "zod";

export const routePolylineSchema = z.array(z.tuple([z.number(), z.number()]));

export const routeSegmentSchema = z.object({
  distance_mi: z.number(),
  duration_s: z.number().int(),
  from_index: z.number().int(),
  to_index: z.number().int(),
});

export const routeSummarySchema = z.object({
  distance_mi: z.number(),
  duration_s: z.number().int(),
});

export const tripResponseSchema = z.object({
  // Server-side model guarantees UUID4; FE treats the id as opaque.
  id: z.string(),
  created_at: z.string(),
  current_label: z.string(),
  current_lat: z.number(),
  current_lon: z.number(),
  pickup_label: z.string(),
  pickup_lat: z.number(),
  pickup_lon: z.number(),
  dropoff_label: z.string(),
  dropoff_lat: z.number(),
  dropoff_lon: z.number(),
  cycle_hours_used: z.string(),
  route_polyline: routePolylineSchema,
  route_segments: z.array(routeSegmentSchema),
  route_summary: routeSummarySchema,
});

export type RouteSegment = z.infer<typeof routeSegmentSchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type TripResponse = z.infer<typeof tripResponseSchema>;
