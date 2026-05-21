import { describe, expect, it } from "vitest";

import { formatSeconds } from "@/features/log-sheet/utils/format-seconds";

describe("formatSeconds", () => {
  it("renders 0 as 0h 0m", () => {
    expect(formatSeconds(0)).toBe("0h 0m");
  });

  it("renders an exact hour", () => {
    expect(formatSeconds(3600)).toBe("1h 0m");
  });

  it("renders mixed hours + minutes", () => {
    expect(formatSeconds(5400)).toBe("1h 30m");
  });

  it("renders a full day as 24h 0m", () => {
    expect(formatSeconds(86_400)).toBe("24h 0m");
  });

  it("floors seconds into the minute, not the next minute", () => {
    expect(formatSeconds(5459)).toBe("1h 30m");
  });

  it("guards against NaN", () => {
    expect(formatSeconds(Number.NaN)).toBe("0h 0m");
  });

  it("guards against negatives", () => {
    expect(formatSeconds(-60)).toBe("0h 0m");
  });
});
