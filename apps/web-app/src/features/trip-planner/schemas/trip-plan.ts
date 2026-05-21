import { z } from "zod";

// Mirrors web_api/apps/trips/models.py::StopKind. Backend serializer emits the
// raw choice value (snake_case), and the FE only renders by `kind`, so this
// stays a simple enum.
export const stopKindSchema = z.enum(["pickup", "dropoff", "fuel", "break", "sleeper", "restart"]);

// Mirrors web_api/apps/trips/models.py::DutyStatusChoices. Consumed by the
// §395.8 SVG renderer (spec 08); included here so the entire plan envelope
// parses through one schema.
export const dutyStatusSchema = z.enum([
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty_not_driving",
]);

// DRF serializes DecimalField as string; coerce so consumers see numbers.
export const tripStopSchema = z.object({
  id: z.uuid(),
  kind: stopKindSchema,
  sequence: z.number().int().nonnegative(),
  polyline_index: z.number().int().nonnegative(),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  label: z.string(),
  scheduled_at: z.iso.datetime({ offset: true }),
  duration_s: z.number().int().nonnegative(),
});

export const logEventSchema = z.object({
  id: z.uuid(),
  sequence: z.number().int().nonnegative(),
  status: dutyStatusSchema,
  start: z.iso.datetime({ offset: true }),
  duration_s: z.number().int().nonnegative(),
  location: z.string(),
  note: z.string(),
});

export const logDaySchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  off_duty_s: z.number().int().nonnegative(),
  sleeper_s: z.number().int().nonnegative(),
  driving_s: z.number().int().nonnegative(),
  on_duty_not_driving_s: z.number().int().nonnegative(),
  total_miles: z.coerce.number(),
});

export const tripPlanSchema = z.object({
  trip_id: z.uuid(),
  start_at: z.iso.datetime({ offset: true }),
  home_terminal_tz: z.string().min(1),
  stops: z.array(tripStopSchema),
  events: z.array(logEventSchema),
  days: z.array(logDaySchema),
});

export type StopKind = z.infer<typeof stopKindSchema>;
export type DutyStatus = z.infer<typeof dutyStatusSchema>;
export type TripStop = z.infer<typeof tripStopSchema>;
export type LogEvent = z.infer<typeof logEventSchema>;
export type LogDay = z.infer<typeof logDaySchema>;
export type TripPlan = z.infer<typeof tripPlanSchema>;
