/**
 * Wire-form export modes. Kebab-case mirrors the spec-10 phase-1 BE contract
 * (``ExportMode.to_wire``); the FE never sees the snake_case DB form.
 *
 * Adding a third mode requires editing this file + the corresponding BE
 * ``ExportMode`` TextChoices member; the BE's ``to_wire`` / ``from_wire``
 * classmethods derive translation programmatically so no serializer edit is
 * needed.
 */

export const EXPORT_MODES = ["multi-page", "single-page"] as const;

export type ExportMode = (typeof EXPORT_MODES)[number];

export function isExportMode(value: unknown): value is ExportMode {
  return typeof value === "string" && (EXPORT_MODES as readonly string[]).includes(value);
}
