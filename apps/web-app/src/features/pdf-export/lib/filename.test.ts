import { describe, expect, it } from "vitest";

import { buildPdfFilename } from "@/features/pdf-export/lib/filename";

describe("buildPdfFilename", () => {
  const FROZEN_NOW = new Date(2026, 4, 21, 14, 35, 7); // 2026-05-21 14:35:07 local

  it("composes the multi-page filename with the 8-char trip-id prefix + YYYYMMDD", () => {
    const filename = buildPdfFilename(
      "8c2d4f1a-1234-5678-9012-345678901234",
      "multi-page",
      FROZEN_NOW,
    );

    expect(filename).toBe("trip-8c2d4f1a-logs-20260521.pdf");
  });

  it("appends the -singlepage suffix in single-page mode", () => {
    const filename = buildPdfFilename(
      "abcd1234-aaaa-bbbb-cccc-dddddddddddd",
      "single-page",
      FROZEN_NOW,
    );

    expect(filename).toBe("trip-abcd1234-logs-20260521-singlepage.pdf");
  });

  it("appends a -recreated-HHMMSS stamp when re-downloaded", () => {
    const filename = buildPdfFilename(
      "abcd1234-aaaa-bbbb-cccc-dddddddddddd",
      "multi-page",
      FROZEN_NOW,
      { recreated: true },
    );

    expect(filename).toBe("trip-abcd1234-logs-20260521-recreated-143507.pdf");
  });

  it("composes both suffixes when single-page is recreated", () => {
    const filename = buildPdfFilename(
      "abcd1234-aaaa-bbbb-cccc-dddddddddddd",
      "single-page",
      FROZEN_NOW,
      { recreated: true },
    );

    expect(filename).toBe("trip-abcd1234-logs-20260521-singlepage-recreated-143507.pdf");
  });

  it("zero-pads single-digit month + day + hour + minute + second", () => {
    const earlyJan = new Date(2026, 0, 3, 4, 5, 6); // 2026-01-03 04:05:06

    const filename = buildPdfFilename(
      "12345678-aaaa-bbbb-cccc-dddddddddddd",
      "multi-page",
      earlyJan,
      {
        recreated: true,
      },
    );

    expect(filename).toBe("trip-12345678-logs-20260103-recreated-040506.pdf");
  });
});
