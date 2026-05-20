import { describe, expect, it } from "vitest";

import { formatDuration } from "@/features/trip-planner/utils/format-duration";

describe("formatDuration", () => {
  it("renders 0 as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("renders sub-minute non-zero as <1m", () => {
    expect(formatDuration(30)).toBe("<1m");
  });

  it("renders exactly 60 as 1m (zero hours)", () => {
    expect(formatDuration(60)).toBe("1m");
  });

  it("renders exactly 3600 as 1h 0m", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });

  it("renders 5h 18m for 19080 seconds (golden trip)", () => {
    expect(formatDuration(19080)).toBe("5h 18m");
  });

  it("renders negative as 0m (treat as no-time)", () => {
    expect(formatDuration(-1)).toBe("0m");
  });
});
