// Render a non-negative second count as the `<H>h <M>m` form the §395.8 grid
// uses in its Total Hours column. Always emits both segments so the column
// reads as a regular ledger.
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0h 0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
