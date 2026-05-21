import { describe, expect, it } from "vitest";

import { savedExportSchema } from "@/features/exports/schemas/saved-export";

describe("savedExportSchema", () => {
  it("parses a multi-page record with a live trip", () => {
    const parsed = savedExportSchema.parse({
      id: "00000000-0000-4000-8000-0000000004a1",
      trip_id: "00000000-0000-4000-8000-000000000001",
      mode: "multi-page",
      sheet_count: 2,
      trip_current_label: "Richmond, VA",
      trip_pickup_label: "Fredericksburg, VA",
      trip_dropoff_label: "Newark, NJ",
      created_at: "2026-05-21T13:05:00Z",
    });
    expect(parsed.mode).toBe("multi-page");
    expect(parsed.trip_id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("accepts trip_id = null (orphaned audit row after trip deletion)", () => {
    const parsed = savedExportSchema.parse({
      id: "00000000-0000-4000-8000-0000000004a2",
      trip_id: null,
      mode: "single-page",
      sheet_count: 3,
      trip_current_label: "Los Angeles, CA",
      trip_pickup_label: "Phoenix, AZ",
      trip_dropoff_label: "Albuquerque, NM",
      created_at: "2026-05-15T20:14:30Z",
    });
    expect(parsed.trip_id).toBeNull();
  });

  it("rejects an unknown mode (BE enum drift fails closed)", () => {
    const result = savedExportSchema.safeParse({
      id: "00000000-0000-4000-8000-0000000004a3",
      trip_id: null,
      mode: "compact-grid",
      sheet_count: 1,
      trip_current_label: "x",
      trip_pickup_label: "y",
      trip_dropoff_label: "z",
      created_at: "2026-05-15T20:14:30Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative sheet_count", () => {
    const result = savedExportSchema.safeParse({
      id: "00000000-0000-4000-8000-0000000004a4",
      trip_id: null,
      mode: "multi-page",
      sheet_count: -1,
      trip_current_label: "x",
      trip_pickup_label: "y",
      trip_dropoff_label: "z",
      created_at: "2026-05-15T20:14:30Z",
    });
    expect(result.success).toBe(false);
  });
});
