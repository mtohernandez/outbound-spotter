const QUARTER_HOUR_MS = 15 * 60 * 1000;

export function roundUpToNext15Min(date: Date): Date {
  const ms = date.getTime();
  return new Date(Math.ceil(ms / QUARTER_HOUR_MS) * QUARTER_HOUR_MS);
}

/**
 * Format a Date for an `<input type="datetime-local">` (no timezone, no seconds).
 * The browser interprets the value in the user's local TZ, which is the
 * intended UX: drivers pick their shift start in their own clock.
 */
export function toDatetimeLocalValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${String(y)}-${m}-${d}T${hh}:${mm}`;
}

/**
 * Inverse: take the value an `<input type="datetime-local">` produced and
 * return an ISO 8601 string with offset reflecting the user's local TZ.
 */
export function fromDatetimeLocalValue(value: string): string {
  // `new Date(localValue)` parses as local-time per spec.
  return new Date(value).toISOString();
}
