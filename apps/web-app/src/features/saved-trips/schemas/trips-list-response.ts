import { z } from "zod";

import { savedTripSchema } from "@/features/saved-trips/schemas/saved-trip";

// DRF's LimitOffsetPagination envelope. `next` and `previous` are absolute
// URLs (or null at the page boundaries); we don't parse them — TanStack derives
// `pageCount` from `count / limit` and the FE owns the offset advance.
export const tripsListResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.url().nullable(),
  previous: z.url().nullable(),
  results: z.array(savedTripSchema),
});

export type TripsListResponse = z.infer<typeof tripsListResponseSchema>;
