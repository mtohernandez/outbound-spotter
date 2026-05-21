import { describe, expect, it } from "vitest";

import { GRID_WIDTH, HOUR_WIDTH } from "@/features/log-sheet/components/grid-geometry";
import { eventsByDay } from "@/features/log-sheet/utils/events-by-day";
import type { LogEvent } from "@/features/trip-planner/schemas/trip-plan";

const TZ = "America/New_York";

function makeEvent(partial: Partial<LogEvent> & { start: string; duration_s: number }): LogEvent {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sequence: 0,
    status: "driving",
    location: "Richmond, VA",
    note: "En route",
    ...partial,
  };
}

describe("eventsByDay", () => {
  it("emits no fragments when events list is empty", () => {
    expect(eventsByDay([], "2026-05-21", TZ)).toEqual([]);
  });

  it("emits a single fragment for a within-day event", () => {
    const events = [makeEvent({ start: "2026-05-21T14:00:00-04:00", duration_s: 7200 })];
    const fragments = eventsByDay(events, "2026-05-21", TZ);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.startX).toBe(HOUR_WIDTH * 14);
    expect(fragments[0]?.endX).toBe(HOUR_WIDTH * 16);
    expect(fragments[0]?.startsBefore).toBe(false);
    expect(fragments[0]?.endsAfter).toBe(false);
  });

  it("clamps a midnight-crossing event to the grid edges, emitting on both days", () => {
    // 22:00–02:00 next day = 4h spanning 2026-05-21 → 2026-05-22.
    const events = [makeEvent({ start: "2026-05-21T22:00:00-04:00", duration_s: 4 * 3600 })];

    const day1 = eventsByDay(events, "2026-05-21", TZ);
    expect(day1).toHaveLength(1);
    expect(day1[0]?.startX).toBe(HOUR_WIDTH * 22);
    expect(day1[0]?.endX).toBe(GRID_WIDTH);
    expect(day1[0]?.startsBefore).toBe(false);
    expect(day1[0]?.endsAfter).toBe(true);

    const day2 = eventsByDay(events, "2026-05-22", TZ);
    expect(day2).toHaveLength(1);
    expect(day2[0]?.startX).toBe(0);
    expect(day2[0]?.endX).toBe(HOUR_WIDTH * 2);
    expect(day2[0]?.startsBefore).toBe(true);
    expect(day2[0]?.endsAfter).toBe(false);
  });

  it("skips events that end before the day starts", () => {
    const events = [makeEvent({ start: "2026-05-20T22:00:00-04:00", duration_s: 3600 })];
    expect(eventsByDay(events, "2026-05-21", TZ)).toEqual([]);
  });

  it("skips events that start after the day ends", () => {
    const events = [makeEvent({ start: "2026-05-22T10:00:00-04:00", duration_s: 3600 })];
    expect(eventsByDay(events, "2026-05-21", TZ)).toEqual([]);
  });

  it("does not mutate the source events array", () => {
    const source = [makeEvent({ start: "2026-05-21T22:00:00-04:00", duration_s: 4 * 3600 })];
    const snapshot = structuredClone(source);
    eventsByDay(source, "2026-05-21", TZ);
    eventsByDay(source, "2026-05-22", TZ);
    expect(source).toEqual(snapshot);
  });

  it("preserves input order for multiple events on the same day", () => {
    const events: LogEvent[] = [
      makeEvent({
        sequence: 0,
        start: "2026-05-21T14:00:00-04:00",
        duration_s: 900,
        status: "on_duty_not_driving",
      }),
      makeEvent({
        sequence: 1,
        start: "2026-05-21T14:15:00-04:00",
        duration_s: 3600,
        status: "driving",
      }),
    ];
    const fragments = eventsByDay(events, "2026-05-21", TZ);
    expect(fragments.map((f) => f.event.sequence)).toEqual([0, 1]);
  });
});
