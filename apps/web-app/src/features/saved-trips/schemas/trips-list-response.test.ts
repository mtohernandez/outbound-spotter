import { describe, expect, it } from "vitest";

import { tripsListResponseSchema } from "@/features/saved-trips/schemas/trips-list-response";

const ROW = {
  id: "00000000-0000-4000-8000-000000000001",
  current_label: "Richmond, VA",
  pickup_label: "Fredericksburg, VA",
  dropoff_label: "Newark, NJ",
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
  days_count: 1,
  start_at: "2026-05-21T14:00:00-04:00",
  created_at: "2026-05-20T12:00:00Z",
};

const ENVELOPE = {
  count: 1,
  next: null,
  previous: null,
  results: [ROW],
};

describe("tripsListResponseSchema", () => {
  it("parses a single-page envelope", () => {
    const parsed = tripsListResponseSchema.parse(ENVELOPE);

    expect(parsed.count).toBe(1);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.next).toBeNull();
  });

  it("accepts absolute URLs for next / previous", () => {
    const parsed = tripsListResponseSchema.parse({
      ...ENVELOPE,
      count: 60,
      next: "http://localhost:8000/api/trips/?limit=50&offset=50",
      previous: "http://localhost:8000/api/trips/?limit=50",
    });

    expect(parsed.next).toMatch(/offset=50/);
    expect(parsed.previous).toMatch(/limit=50/);
  });

  it("rejects an envelope whose result row is malformed", () => {
    const result = tripsListResponseSchema.safeParse({
      ...ENVELOPE,
      results: [{ ...ROW, id: "not-a-uuid" }],
    });

    expect(result.success).toBe(false);
  });
});
