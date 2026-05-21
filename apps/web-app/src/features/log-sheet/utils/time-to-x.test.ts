import { describe, expect, it } from "vitest";

import { GRID_WIDTH, HOUR_WIDTH } from "@/features/log-sheet/components/grid-geometry";
import { timeToX } from "@/features/log-sheet/utils/time-to-x";

const TZ = "America/New_York";

describe("timeToX", () => {
  it("returns 0 for an instant before the day starts in tz", () => {
    expect(timeToX("2026-05-20T23:00:00-04:00", "2026-05-21", TZ)).toBe(0);
  });

  it("returns GRID_WIDTH for an instant on the next day in tz", () => {
    expect(timeToX("2026-05-22T00:30:00-04:00", "2026-05-21", TZ)).toBe(GRID_WIDTH);
  });

  it("returns 0 for the day-start midnight in tz", () => {
    expect(timeToX("2026-05-21T00:00:00-04:00", "2026-05-21", TZ)).toBe(0);
  });

  it("returns HOUR_WIDTH * 6 for 6:00 AM local in tz", () => {
    expect(timeToX("2026-05-21T06:00:00-04:00", "2026-05-21", TZ)).toBe(HOUR_WIDTH * 6);
  });

  it("returns HOUR_WIDTH * 14.25 for 14:15 local (mid-quarter)", () => {
    expect(timeToX("2026-05-21T14:15:00-04:00", "2026-05-21", TZ)).toBe(HOUR_WIDTH * 14.25);
  });

  it("honors a different home-terminal tz", () => {
    // 14:00 in America/Los_Angeles is 17:00 in America/New_York. Confirm we
    // anchor on the tz parameter, not the offset suffix.
    expect(timeToX("2026-05-21T14:00:00-07:00", "2026-05-21", "America/Los_Angeles")).toBe(
      HOUR_WIDTH * 14,
    );
  });

  it("handles the US spring-forward day correctly", () => {
    // 2026-03-08 in America/New_York: clocks jump from 02:00 EST to 03:00 EDT.
    // An instant at 06:30 local (EDT, UTC-04) → minute 390 from midnight EST.
    // The visual grid is 24 hours wide regardless of DST shift; the x-coord
    // reflects WALL-CLOCK time on the grid, not elapsed minutes.
    const x = timeToX("2026-03-08T06:30:00-04:00", "2026-03-08", TZ);
    expect(x).toBe(HOUR_WIDTH * 6.5);
  });

  it("handles the US fall-back day correctly", () => {
    // 2026-11-01: clocks fall from 02:00 EDT to 01:00 EST. 03:45 EST = wall
    // clock 3:45 AM, regardless of the second 01:00–02:00 EST hour.
    const x = timeToX("2026-11-01T03:45:00-05:00", "2026-11-01", TZ);
    expect(x).toBe(HOUR_WIDTH * 3.75);
  });
});
