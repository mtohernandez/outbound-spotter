import { describe, expect, it } from "vitest";

import { routeSummarySchema, savedTripSchema } from "@/features/saved-trips/schemas/saved-trip";

const VALID = {
  id: "00000000-0000-4000-8000-000000000001",
  current_label: "Richmond, VA",
  pickup_label: "Fredericksburg, VA",
  dropoff_label: "Newark, NJ",
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
  days_count: 2,
  start_at: "2026-05-21T14:00:00-04:00",
  created_at: "2026-05-20T12:00:00Z",
};

describe("savedTripSchema", () => {
  it("parses a well-formed list row", () => {
    const parsed = savedTripSchema.parse(VALID);

    expect(parsed.id).toBe(VALID.id);
    expect(parsed.route_summary.distance_mi).toBe(342.7);
    expect(parsed.days_count).toBe(2);
  });

  it("rejects a negative days_count", () => {
    const result = savedTripSchema.safeParse({ ...VALID, days_count: -1 });

    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    const result = savedTripSchema.safeParse({ ...VALID, id: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("rejects a start_at without timezone offset", () => {
    const result = savedTripSchema.safeParse({ ...VALID, start_at: "2026-05-21T14:00:00" });

    expect(result.success).toBe(false);
  });
});

describe("routeSummarySchema", () => {
  it("requires integer duration_s", () => {
    const result = routeSummarySchema.safeParse({ distance_mi: 100, duration_s: 60.5 });

    expect(result.success).toBe(false);
  });
});
