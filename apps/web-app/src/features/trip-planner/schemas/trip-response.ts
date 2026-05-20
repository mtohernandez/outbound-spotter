import { z } from "zod";

export const routeErrorCodeEnum = z.enum([
  "rate_limit_per_minute",
  "rate_limit_daily",
  "upstream",
  "validation",
]);

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

const baseTripFields = {
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
} as const;

export const tripPlannedSchema = z.object({
  ...baseTripFields,
  status: z.literal("planned"),
  route_polyline: routePolylineSchema,
  route_segments: z.array(routeSegmentSchema),
  route_summary: routeSummarySchema,
  route_error_code: z.null(),
});

export const tripPlanningSchema = z.object({
  ...baseTripFields,
  status: z.literal("planning"),
  route_polyline: z.null(),
  route_segments: z.null(),
  route_summary: z.null(),
  route_error_code: z.null(),
});

export const tripFailedSchema = z.object({
  ...baseTripFields,
  status: z.literal("failed"),
  route_polyline: z.null(),
  route_segments: z.null(),
  route_summary: z.null(),
  route_error_code: routeErrorCodeEnum,
});

export const tripResponseSchema = z.discriminatedUnion("status", [
  tripPlannedSchema,
  tripPlanningSchema,
  tripFailedSchema,
]);

export type RouteErrorCode = z.infer<typeof routeErrorCodeEnum>;
export type RouteSegment = z.infer<typeof routeSegmentSchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type TripResponse = z.infer<typeof tripResponseSchema>;
export type TripPlanned = z.infer<typeof tripPlannedSchema>;
export type TripPlanning = z.infer<typeof tripPlanningSchema>;
export type TripFailed = z.infer<typeof tripFailedSchema>;
