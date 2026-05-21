import { describe, expect, it } from "vitest";

import { formatStartAt } from "@/features/trip-planner/utils/format-start-at";

describe("formatStartAt", () => {
  it("renders an ISO 8601 instant in America/New_York with medium date + short time", () => {
    // 2026-05-25T10:00:00Z = 06:00 EDT (May = DST)
    const output = formatStartAt("2026-05-25T10:00:00Z");
    expect(output).toContain("May");
    expect(output).toContain("2026");
    expect(output).toContain("6:00");
  });

  it("returns em-dash on a malformed ISO", () => {
    expect(formatStartAt("not-a-date")).toBe("—");
  });

  it("honors the timeZone override", () => {
    // Same instant in UTC reads as 10:00 AM.
    const output = formatStartAt("2026-05-25T10:00:00Z", "UTC");
    expect(output).toContain("10:00");
  });

  it("renders an offset-suffixed ISO correctly", () => {
    // 2026-12-15T08:00:00-05:00 = 13:00 UTC = 08:00 EST (Dec = no DST)
    const output = formatStartAt("2026-12-15T08:00:00-05:00");
    expect(output).toContain("8:00");
  });
});
