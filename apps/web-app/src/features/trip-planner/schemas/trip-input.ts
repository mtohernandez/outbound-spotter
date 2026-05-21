import { z } from "zod";

export const resolvedAddressSchema = z.object({
  label: z.string().min(1, "Pick an address from the list"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  confidence: z.number().min(0).max(1).nullable(),
});

export const cycleHoursUsedSchema = z
  .number({ message: "Enter hours used" })
  .min(0, "Must be at least 0")
  .max(70, "Cannot exceed 70 hours")
  .multipleOf(0.5, "Use half-hour increments");

// 5 min of past slack mirrors the BE validator (architect-review M1 on spec
// 06) — absorbs clock skew between client and server.
const START_AT_PAST_SLACK_MS = 5 * 60 * 1000;

export const startAtSchema = z.iso
  .datetime({ offset: true, message: "Pick a valid date and time" })
  .refine((iso) => new Date(iso).valueOf() >= Date.now() - START_AT_PAST_SLACK_MS, {
    message: "Start time cannot be in the past.",
  });

export const tripInputSchema = z.object({
  current: resolvedAddressSchema,
  pickup: resolvedAddressSchema,
  dropoff: resolvedAddressSchema,
  cycleHoursUsed: cycleHoursUsedSchema,
  startAt: startAtSchema,
});

export type ResolvedAddress = z.infer<typeof resolvedAddressSchema>;
export type TripInput = z.infer<typeof tripInputSchema>;

export const emptyResolvedAddress: ResolvedAddress = {
  label: "",
  lat: 0,
  lon: 0,
  confidence: null,
};
