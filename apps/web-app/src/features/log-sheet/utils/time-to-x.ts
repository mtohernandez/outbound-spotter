import { HOUR_WIDTH, MINUTES_PER_DAY } from "@/features/log-sheet/components/grid-geometry";

// Tz-local wall-clock extraction. Returns the YYYY-MM-DD date + the minutes
// past midnight in `timeZone` for an offset-aware ISO 8601 instant. Uses the
// en-CA locale because it emits hyphenated YYYY-MM-DD with 2-digit parts and
// honors the `hour24` cycle predictably; we extract via parts to avoid locale
// dialect drift.
export function tzWallClock(iso: string, timeZone: string): { date: string; minutes: number } {
  const instant = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? "00";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  // h23 cycle reports midnight as "00", but a defensive normalization keeps
  // the renderer correct if a future Intl polyfill emits "24".
  const hourRaw = Number.parseInt(part("hour"), 10);
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const minute = Number.parseInt(part("minute"), 10);
  return { date: `${year}-${month}-${day}`, minutes: hour * 60 + minute };
}

// ISO 8601 instant → x pixel coordinate on the 24-hour grid for `dayDate`.
// Clamps to 0 if the instant falls before midnight of `dayDate` in
// `timeZone`, and to `MINUTES_PER_DAY * pxPerMinute` if it falls on or after
// midnight of the next day. Pure; deterministic. DST transitions are handled
// by Intl because we read the tz-local wall clock, not the UTC offset.
export function timeToX(
  iso: string,
  dayDate: string,
  timeZone: string,
  hourWidth: number = HOUR_WIDTH,
): number {
  const { date, minutes } = tzWallClock(iso, timeZone);
  const pxPerMinute = hourWidth / 60;
  if (date < dayDate) return 0;
  if (date > dayDate) return MINUTES_PER_DAY * pxPerMinute;
  return minutes * pxPerMinute;
}
