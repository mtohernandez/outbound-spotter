import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderTripPdf } from "@/features/pdf-export/lib/render-trip-pdf";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface MockPdfInstance {
  svg: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
  output: ReturnType<typeof vi.fn>;
  __ctorArgs: unknown;
}

const pdfInstances: MockPdfInstance[] = [];

vi.mock("jspdf", () => {
  return {
    default: class {
      svg = vi.fn().mockResolvedValue(undefined);
      addPage = vi.fn();
      setPage = vi.fn();
      setFont = vi.fn();
      setFontSize = vi.fn();
      getFontSize = vi.fn().mockReturnValue(11);
      text = vi.fn();
      internal = {
        pageSize: {
          getHeight: vi.fn().mockReturnValue(792),
          getWidth: vi.fn().mockReturnValue(612),
        },
      };
      output = vi.fn(
        () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" }),
      );
      __ctorArgs: unknown;

      constructor(args: unknown) {
        this.__ctorArgs = args;
        pdfInstances.push(this);
      }
    },
  };
});

// svg2pdf.js' default side-effect import installs the .svg() method on jsPDF
// at module load. Since we replace jsPDF wholesale with a mock that already
// has .svg(), this stub keeps the import resolvable in tests.
vi.mock("svg2pdf.js", () => ({}));

const SVG_NS = "http://www.w3.org/2000/svg";

function makeLogDay(id: string, dateIso: string): LogDay {
  return {
    id,
    date: dateIso,
    off_duty_s: 0,
    sleeper_s: 0,
    driving_s: 30_000,
    on_duty_not_driving_s: 0,
    total_miles: 200,
  };
}

function mountSheetSvg(dayId: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("id", `daily-log-sheet-${dayId}`);
  svg.setAttribute("viewBox", "0 0 896 820");
  document.body.appendChild(svg);
  return svg;
}

beforeEach(() => {
  pdfInstances.length = 0;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderTripPdf", () => {
  it("multi-page mode calls pdf.svg N times and addPage N-1 times for N days", async () => {
    const days = [
      makeLogDay("aaa-1", "2026-05-21"),
      makeLogDay("aaa-2", "2026-05-22"),
      makeLogDay("aaa-3", "2026-05-23"),
    ];
    for (const day of days) mountSheetSvg(day.id);

    await renderTripPdf({ days, mode: "multi-page" });

    expect(pdfInstances).toHaveLength(1);
    const pdf = pdfInstances[0];
    expect(pdf?.svg).toHaveBeenCalledTimes(3);
    expect(pdf?.addPage).toHaveBeenCalledTimes(2);
  });

  it("single-page mode calls pdf.svg N times and never addPage", async () => {
    const days = [makeLogDay("bbb-1", "2026-05-21"), makeLogDay("bbb-2", "2026-05-22")];
    for (const day of days) mountSheetSvg(day.id);

    await renderTripPdf({ days, mode: "single-page" });

    const pdf = pdfInstances[0];
    expect(pdf?.svg).toHaveBeenCalledTimes(2);
    expect(pdf?.addPage).not.toHaveBeenCalled();
  });

  it("single-page mode sizes the page height by N × sheetHeight + gutters + margins", async () => {
    const days = [makeLogDay("ccc-1", "2026-05-21"), makeLogDay("ccc-2", "2026-05-22")];
    for (const day of days) mountSheetSvg(day.id);

    await renderTripPdf({ days, mode: "single-page" });

    const ctor = pdfInstances[0]?.__ctorArgs as { format?: [number, number] };
    expect(Array.isArray(ctor.format)).toBe(true);
    expect(ctor.format?.[0]).toBe(612);
    // Two sheets + one gutter + two margins; check the second sheet's y offset.
    const pdf = pdfInstances[0];
    const secondCall = pdf?.svg.mock.calls[1]?.[1] as { y: number } | undefined;
    expect(secondCall?.y).toBeGreaterThan(500);
  });

  it("returns a Blob with PDF mime type", async () => {
    const day = makeLogDay("ddd-1", "2026-05-21");
    mountSheetSvg(day.id);

    const blob = await renderTripPdf({ days: [day], mode: "multi-page" });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
  });

  it("throws when an expected SVG is missing from the DOM", async () => {
    const day = makeLogDay("eee-1", "2026-05-21");
    // Deliberately don't mount the sheet.

    await expect(renderTripPdf({ days: [day], mode: "multi-page" })).rejects.toThrow(
      /Couldn't find the daily-log-sheet SVG/,
    );
  });

  it("rejects an empty day list", async () => {
    await expect(renderTripPdf({ days: [], mode: "multi-page" })).rejects.toThrow(/empty trip/);
  });

  it("removes the off-screen clone wrappers after rendering", async () => {
    const days = [makeLogDay("fff-1", "2026-05-21"), makeLogDay("fff-2", "2026-05-22")];
    for (const day of days) mountSheetSvg(day.id);

    await renderTripPdf({ days, mode: "multi-page" });

    // The two source SVGs remain in the document; the hydration wrappers
    // (off-screen ``fixed`` divs) should have been cleaned up.
    const offscreen = Array.from(document.body.children).filter(
      (el) => el instanceof HTMLDivElement && el.style.position === "fixed",
    );
    expect(offscreen).toHaveLength(0);
  });
});
