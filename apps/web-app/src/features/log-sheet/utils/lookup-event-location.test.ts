import { describe, expect, it } from "vitest";

import {
  firstDrivingSequence,
  lookupEventLocation,
} from "@/features/log-sheet/utils/lookup-event-location";
import type { LogEvent, TripStop } from "@/features/trip-planner/schemas/trip-plan";

const TRIP_LABELS = {
  current_label: "Richmond, VA",
  pickup_label: "Fredericksburg, VA",
  dropoff_label: "Newark, NJ",
};

function makeEvent(partial: Partial<LogEvent>): LogEvent {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sequence: 0,
    status: "on_duty_not_driving",
    start: "2026-05-21T14:00:00-04:00",
    duration_s: 900,
    location: "Richmond, VA",
    note: "Pre-trip inspection",
    ...partial,
  };
}

function makeStop(partial: Partial<TripStop>): TripStop {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    kind: "pickup",
    sequence: 0,
    polyline_index: 1,
    lat: 38.3032,
    lon: -77.4605,
    label: "",
    scheduled_at: "2026-05-21T15:30:00-04:00",
    duration_s: 3600,
    ...partial,
  };
}

describe("lookupEventLocation — three-tier precedence", () => {
  it("tier 1: Pickup note resolves to trip.pickup_label", () => {
    const event = makeEvent({ note: "Pickup", sequence: 2, location: "Some Other Spot" });
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops: [],
      firstDrivingEventSequence: 1,
    });
    expect(out).toBe("Fredericksburg, VA");
  });

  it("tier 1: Dropoff note resolves to trip.dropoff_label", () => {
    const event = makeEvent({ note: "Dropoff", sequence: 4, location: "Stale" });
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops: [],
      firstDrivingEventSequence: 1,
    });
    expect(out).toBe("Newark, NJ");
  });

  it("tier 1: first driving event resolves to trip.current_label", () => {
    const event = makeEvent({ sequence: 1, status: "driving", note: "En route", location: "" });
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops: [],
      firstDrivingEventSequence: 1,
    });
    expect(out).toBe("Richmond, VA");
  });

  it("tier 2: matching TripStop.label by scheduled-time proximity (≤5 min)", () => {
    const event = makeEvent({
      note: "30-min break (§395.3(a)(3)(ii))",
      start: "2026-05-21T18:00:00-04:00",
      location: "",
    });
    const stops = [
      makeStop({
        kind: "break",
        scheduled_at: "2026-05-21T18:02:00-04:00",
        label: "Truck Stop — Wilmington, DE",
      }),
    ];
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops,
      firstDrivingEventSequence: null,
    });
    expect(out).toBe("Truck Stop — Wilmington, DE");
  });

  it("tier 2: empty stop label falls through to tier 3", () => {
    const event = makeEvent({
      note: "Fueling",
      start: "2026-05-21T18:00:00-04:00",
      location: "Service Plaza, NJ",
    });
    const stops = [
      makeStop({
        kind: "fuel",
        scheduled_at: "2026-05-21T18:02:00-04:00",
        label: "", // spec 10 fills this; v1 empty
      }),
    ];
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops,
      firstDrivingEventSequence: null,
    });
    expect(out).toBe("Service Plaza, NJ");
  });

  it("tier 3: planner-supplied location string when no Tier 1/2 hits", () => {
    const event = makeEvent({
      sequence: 5,
      note: "10-hour off-duty (§395.3(a)(2))",
      location: "Rest Area, MD",
    });
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops: [],
      firstDrivingEventSequence: 1,
    });
    expect(out).toBe("Rest Area, MD");
  });

  it("tier 4: lat/lon fallback from a proximate-but-unlabeled stop", () => {
    const event = makeEvent({
      start: "2026-05-21T18:00:00-04:00",
      note: "",
      location: "",
    });
    const stops = [
      makeStop({
        scheduled_at: "2026-05-21T18:00:00-04:00",
        label: "",
        lat: 39.1234,
        lon: -76.5678,
      }),
    ];
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops,
      firstDrivingEventSequence: null,
    });
    expect(out).toBe("39.1234, -76.5678");
  });

  it("last resort: surfaces the note when every tier fails", () => {
    const event = makeEvent({ note: "Some explanatory text", location: "" });
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops: [],
      firstDrivingEventSequence: null,
    });
    expect(out).toBe("Some explanatory text");
  });

  it("last resort: em-dash when nothing at all is known", () => {
    const event = makeEvent({ note: "", location: "" });
    const out = lookupEventLocation({
      event,
      trip: TRIP_LABELS,
      stops: [],
      firstDrivingEventSequence: null,
    });
    expect(out).toBe("—");
  });
});

describe("firstDrivingSequence", () => {
  it("returns the sequence of the first driving event", () => {
    const events: LogEvent[] = [
      makeEvent({ sequence: 0, status: "on_duty_not_driving" }),
      makeEvent({ sequence: 1, status: "driving" }),
      makeEvent({ sequence: 2, status: "driving" }),
    ];
    expect(firstDrivingSequence(events)).toBe(1);
  });

  it("returns null when no driving event exists", () => {
    const events: LogEvent[] = [makeEvent({ sequence: 0, status: "on_duty_not_driving" })];
    expect(firstDrivingSequence(events)).toBeNull();
  });
});
