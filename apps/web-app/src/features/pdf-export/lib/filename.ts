import type { ExportMode } from "@/features/pdf-export/types/export-mode";

interface FilenameOptions {
  readonly recreated?: boolean;
}

const TRIP_ID_SHORT_LENGTH = 8;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function dateStamp(now: Date): string {
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
}

function timeStamp(now: Date): string {
  return `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
}

export function buildPdfFilename(
  tripId: string,
  mode: ExportMode,
  now: Date = new Date(),
  options: FilenameOptions = {},
): string {
  const shortId = tripId.slice(0, TRIP_ID_SHORT_LENGTH);
  const date = dateStamp(now);
  const suffix = mode === "single-page" ? "-singlepage" : "";
  const recreated = options.recreated === true ? `-recreated-${timeStamp(now)}` : "";
  return `trip-${shortId}-logs-${date}${suffix}${recreated}.pdf`;
}
