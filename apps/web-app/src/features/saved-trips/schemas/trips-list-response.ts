import { z } from "zod";

import { savedTripSchema } from "@/features/saved-trips/schemas/saved-trip";

// DRF's LimitOffsetPagination envelope. `next` and `previous` are pagination
// URLs (or null at page boundaries). We don't parse them — TanStack derives
// `pageCount` from `count / limit` and the FE owns the offset advance — so
// we accept any non-empty string. A strict `z.url()` would hard-fail the whole
// list if a reverse proxy ever returns a relative URL (code-reviewer M1).
export const tripsListResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(savedTripSchema),
});

export type TripsListResponse = z.infer<typeof tripsListResponseSchema>;
