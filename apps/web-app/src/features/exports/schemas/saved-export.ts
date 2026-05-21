import { z } from "zod";

import { EXPORT_MODES } from "@/features/pdf-export/types/export-mode";

// Mirrors web_api/apps/exports/serializers.py::TripExportListItemSerializer.
// `trip_id` is nullable because the BE FK uses ``on_delete=SET_NULL`` so audit
// rows survive trip deletion; the denormalized labels keep the route summary
// readable even when the original trip is gone.
export const savedExportSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid().nullable(),
  mode: z.enum(EXPORT_MODES),
  sheet_count: z.number().int().nonnegative(),
  trip_current_label: z.string(),
  trip_pickup_label: z.string(),
  trip_dropoff_label: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

export type SavedExport = z.infer<typeof savedExportSchema>;
