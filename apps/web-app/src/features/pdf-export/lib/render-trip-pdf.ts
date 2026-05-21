import jsPDF from "jspdf";
import "svg2pdf.js";

import { PLANNING_DISCLAIMER } from "@/config/strings";
import { cloneSvgForExport } from "@/features/pdf-export/lib/clone-svg-for-export";
import type { ExportMode } from "@/features/pdf-export/types/export-mode";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 36; // 0.5 in
const SHEET_GUTTER = 18; // 0.25 in between stacked sheets in single-page mode

const SHEET_VIEWBOX_WIDTH = 896;
const SHEET_VIEWBOX_HEIGHT = 820;

const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const SHEET_SCALE = USABLE_WIDTH / SHEET_VIEWBOX_WIDTH;
const SHEET_HEIGHT = SHEET_VIEWBOX_HEIGHT * SHEET_SCALE;
const MULTI_PAGE_Y = (PAGE_HEIGHT - SHEET_HEIGHT) / 2;

export interface RenderTripPdfInput {
  readonly days: readonly LogDay[];
  readonly mode: ExportMode;
}

interface SheetEntry {
  readonly day: LogDay;
  readonly svg: SVGSVGElement;
}

export async function renderTripPdf({ days, mode }: RenderTripPdfInput): Promise<Blob> {
  if (days.length === 0) {
    throw new Error("Cannot render an empty trip — at least one LogDay is required.");
  }

  const sheets = collectSheets(days);
  const cleanups: (() => void)[] = [];

  try {
    const pdf =
      mode === "multi-page"
        ? new jsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true })
        : buildSinglePagePdf(sheets.length);

    if (mode === "multi-page") {
      await renderMultiPage(pdf, sheets, cleanups);
    } else {
      await renderSinglePage(pdf, sheets, cleanups);
    }

    stampDisclaimerOnFirstPage(pdf);

    return pdf.output("blob");
  } finally {
    // Best-effort teardown: one cleanup throwing must not leave the
    // remaining off-screen wrappers in the DOM.
    while (cleanups.length > 0) {
      const next = cleanups.pop();
      try {
        next?.();
      } catch {
        // Swallow; nothing the user can do about a stale clone wrapper.
      }
    }
  }
}

function buildSinglePagePdf(sheetCount: number): jsPDF {
  const totalHeight =
    PAGE_MARGIN * 2 + sheetCount * SHEET_HEIGHT + Math.max(0, sheetCount - 1) * SHEET_GUTTER;
  return new jsPDF({
    unit: "pt",
    format: [PAGE_WIDTH, totalHeight],
    orientation: "portrait",
    compress: true,
  });
}

function collectSheets(days: readonly LogDay[]): SheetEntry[] {
  const sheets: SheetEntry[] = [];
  for (const day of days) {
    const svg = document.getElementById(`daily-log-sheet-${day.id}`);
    if (!(svg instanceof SVGSVGElement)) {
      throw new Error(
        `Couldn't find the daily-log-sheet SVG for day ${day.id}. ` +
          "Ensure the trip-detail Log Sheets tab is mounted before exporting.",
      );
    }
    sheets.push({ day, svg });
  }
  return sheets;
}

async function renderMultiPage(
  pdf: jsPDF,
  sheets: readonly SheetEntry[],
  cleanups: (() => void)[],
): Promise<void> {
  for (let index = 0; index < sheets.length; index += 1) {
    const entry = sheets[index];
    if (entry === undefined) continue;
    const hydration = cloneSvgForExport(entry.svg);
    cleanups.push(hydration.cleanup);
    await pdf.svg(hydration.clone, {
      x: PAGE_MARGIN,
      y: MULTI_PAGE_Y,
      width: USABLE_WIDTH,
      height: SHEET_HEIGHT,
    });
    if (index < sheets.length - 1) {
      pdf.addPage();
    }
  }
}

function stampDisclaimerOnFirstPage(pdf: jsPDF): void {
  // Read the actual page height so single-page mode (variable-height page)
  // gets the disclaimer at its own bottom, not the US-Letter constant.
  // jsPDF page numbers are 1-indexed; setPage(1) is the right call for both
  // multi-page (first sheet) and single-page (only page) modes.
  pdf.setPage(1);
  const pageHeight = pdf.internal.pageSize.getHeight();
  const previousSize = pdf.getFontSize();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(PLANNING_DISCLAIMER, PAGE_MARGIN, pageHeight - 18, {
    maxWidth: USABLE_WIDTH,
  });
  pdf.setFontSize(previousSize);
}

async function renderSinglePage(
  pdf: jsPDF,
  sheets: readonly SheetEntry[],
  cleanups: (() => void)[],
): Promise<void> {
  for (let index = 0; index < sheets.length; index += 1) {
    const entry = sheets[index];
    if (entry === undefined) continue;
    const hydration = cloneSvgForExport(entry.svg);
    cleanups.push(hydration.cleanup);
    const y = PAGE_MARGIN + index * (SHEET_HEIGHT + SHEET_GUTTER);
    await pdf.svg(hydration.clone, {
      x: PAGE_MARGIN,
      y,
      width: USABLE_WIDTH,
      height: SHEET_HEIGHT,
    });
  }
}
