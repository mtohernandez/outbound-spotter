import { describe, expect, it } from "vitest";

import { formatTzLabel } from "@/features/log-sheet/utils/format-tz-label";

describe("formatTzLabel", () => {
  it("maps America/New_York to Eastern", () => {
    expect(formatTzLabel("America/New_York")).toBe("Eastern");
  });

  it("maps America/Chicago to Central", () => {
    expect(formatTzLabel("America/Chicago")).toBe("Central");
  });

  it("maps America/Denver to Mountain", () => {
    expect(formatTzLabel("America/Denver")).toBe("Mountain");
  });

  it("maps America/Los_Angeles to Pacific", () => {
    expect(formatTzLabel("America/Los_Angeles")).toBe("Pacific");
  });

  it("maps America/Anchorage to Alaska", () => {
    expect(formatTzLabel("America/Anchorage")).toBe("Alaska");
  });

  it("maps Pacific/Honolulu to Hawaii", () => {
    expect(formatTzLabel("Pacific/Honolulu")).toBe("Hawaii");
  });

  it("passes unknown zones through unchanged", () => {
    expect(formatTzLabel("Europe/Madrid")).toBe("Europe/Madrid");
  });
});
