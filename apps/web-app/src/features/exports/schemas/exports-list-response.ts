import { z } from "zod";

import { savedExportSchema } from "@/features/exports/schemas/saved-export";

// DRF's LimitOffsetPagination envelope mirroring tripsListResponseSchema.
// ``next`` / ``previous`` are non-strict strings for the same reason — a
// reverse proxy returning a relative URL must not hard-fail the list.
export const exportsListResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(savedExportSchema),
});

export type ExportsListResponse = z.infer<typeof exportsListResponseSchema>;
