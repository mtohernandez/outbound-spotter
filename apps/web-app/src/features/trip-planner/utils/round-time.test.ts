import { describe, expect, it } from "vitest";

import {
  fromDatetimeLocalValue,
  roundUpToNext15Min,
  toDatetimeLocalValue,
} from "@/features/trip-planner/utils/round-time";

describe("roundUpToNext15Min", () => {
  it("returns the same instant when exactly on a quarter", () => {
    const onQuarter = new Date("2026-05-20T10:15:00Z");
    expect(roundUpToNext15Min(onQuarter).getTime()).toBe(onQuarter.getTime());
  });

  it("rounds up by 1 ms past a quarter to the next quarter", () => {
    const justPast = new Date("2026-05-20T10:15:00.001Z");
    expect(roundUpToNext15Min(justPast).toISOString()).toBe("2026-05-20T10:30:00.000Z");
  });

  it("rounds 10:07 up to 10:15", () => {
    const sevenPast = new Date("2026-05-20T10:07:00Z");
    expect(roundUpToNext15Min(sevenPast).toISOString()).toBe("2026-05-20T10:15:00.000Z");
  });

  it("rounds 10:14:59 up to 10:15", () => {
    const fourteenPast = new Date("2026-05-20T10:14:59Z");
    expect(roundUpToNext15Min(fourteenPast).toISOString()).toBe("2026-05-20T10:15:00.000Z");
  });

  it("rounds 23:48 up to 00:00 next day (UTC)", () => {
    const lateNight = new Date("2026-05-20T23:48:00Z");
    expect(roundUpToNext15Min(lateNight).toISOString()).toBe("2026-05-21T00:00:00.000Z");
  });
});

describe("toDatetimeLocalValue / fromDatetimeLocalValue", () => {
  it("formats a Date into the `<input type=datetime-local>` shape", () => {
    // Use a fixed UTC time; the local-formatted output depends on the runner's TZ,
    // so we just assert the shape matches the required regex.
    const value = toDatetimeLocalValue(new Date("2026-05-20T10:30:00Z"));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("round-trips a local value through ISO and back to a parseable Date", () => {
    const local = "2026-05-20T10:30";
    const iso = fromDatetimeLocalValue(local);
    expect(new Date(iso).toString()).not.toBe("Invalid Date");
  });
});
