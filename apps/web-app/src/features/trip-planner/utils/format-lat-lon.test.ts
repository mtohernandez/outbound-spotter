import { describe, expect, it } from "vitest";

import { formatLatLon } from "@/features/trip-planner/utils/format-lat-lon";

describe("formatLatLon", () => {
  it("rounds to four decimal places", () => {
    expect(formatLatLon(40.71279, -74.00599)).toBe("40.7128, -74.0060");
  });

  it("handles whole-number coordinates", () => {
    expect(formatLatLon(0, 0)).toBe("0.0000, 0.0000");
  });

  it("preserves the sign on negative coordinates", () => {
    expect(formatLatLon(-33.8688, 151.2093)).toBe("-33.8688, 151.2093");
  });
});
