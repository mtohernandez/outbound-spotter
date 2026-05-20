import { describe, expect, it } from "vitest";

import { formatDistance } from "@/features/trip-planner/utils/format-distance";

describe("formatDistance", () => {
  it("renders 0 with one decimal", () => {
    expect(formatDistance(0)).toBe("0.0 mi");
  });

  it("rounds 0.05 to 0.1", () => {
    expect(formatDistance(0.05)).toBe("0.1 mi");
  });

  it("renders 342.7 verbatim (golden trip)", () => {
    expect(formatDistance(342.7)).toBe("342.7 mi");
  });

  it("rounds large floats to one decimal", () => {
    expect(formatDistance(9999.999)).toBe("10000.0 mi");
  });
});
