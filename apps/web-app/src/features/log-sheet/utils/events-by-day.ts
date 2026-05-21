import { HOUR_WIDTH } from "@/features/log-sheet/components/grid-geometry";
import { timeToX, tzWallClock } from "@/features/log-sheet/utils/time-to-x";
import type { LogEvent } from "@/features/trip-planner/schemas/trip-plan";

export interface EventFragment {
  readonly event: LogEvent;
  readonly startX: number;
  readonly endX: number;
  // The event began on a previous calendar day in this trip's home-terminal
  // TZ — the left edge has been clamped to the grid's start (no transition
  // line should be drawn from a prior row).
  readonly startsBefore: boolean;
  // The event continues into the next calendar day — the right edge has been
  // clamped to the grid's end (no transition line to a next row on this day).
  readonly endsAfter: boolean;
}

// Split a per-trip `LogEvent[]` into per-day render fragments. Midnight-
// crossing events emit a clamped fragment on each day they touch; the source
// rows are not mutated (invariant #2: one LogEvent row per duty-status
// change). Fragments are returned in `events` order, matching how the
// drawing code traverses them to render transition lines.
export function eventsByDay(
  events: readonly LogEvent[],
  dayDate: string,
  timeZone: string,
  hourWidth: number = HOUR_WIDTH,
): EventFragment[] {
  const fragments: EventFragment[] = [];

  for (const event of events) {
    const startInstantMs = new Date(event.start).valueOf();
    if (Number.isNaN(startInstantMs)) continue;
    const endInstantMs = startInstantMs + event.duration_s * 1000;
    const endIso = new Date(endInstantMs).toISOString();

    const startWall = tzWallClock(event.start, timeZone);
    const endWall = tzWallClock(endIso, timeZone);

    // Outside this day in either direction → skip.
    if (endWall.date < dayDate) continue;
    if (endWall.date === dayDate && endWall.minutes === 0 && startWall.date !== dayDate) {
      // Event ends exactly at the day-start of `dayDate` — zero overlap on this day.
      continue;
    }
    if (startWall.date > dayDate) continue;

    const startX = timeToX(event.start, dayDate, timeZone, hourWidth);
    const endX = timeToX(endIso, dayDate, timeZone, hourWidth);
    if (startX === endX) continue;

    fragments.push({
      event,
      startX,
      endX,
      startsBefore: startWall.date < dayDate,
      endsAfter: endWall.date > dayDate,
    });
  }

  return fragments;
}
