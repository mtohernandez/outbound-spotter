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

export const tripInputSchema = z.object({
  current: resolvedAddressSchema,
  pickup: resolvedAddressSchema,
  dropoff: resolvedAddressSchema,
  cycleHoursUsed: cycleHoursUsedSchema,
});

export type ResolvedAddress = z.infer<typeof resolvedAddressSchema>;
export type TripInput = z.infer<typeof tripInputSchema>;

export const emptyResolvedAddress: ResolvedAddress = {
  label: "",
  lat: 0,
  lon: 0,
  confidence: null,
};
