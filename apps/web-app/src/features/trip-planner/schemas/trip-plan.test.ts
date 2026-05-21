import { describe, expect, it } from "vitest";

import {
  logDaySchema,
  logEventSchema,
  stopKindSchema,
  tripPlanSchema,
  tripStopSchema,
} from "@/features/trip-planner/schemas/trip-plan";

const VALID_STOP = {
  id: "00000000-0000-4000-8000-000000000010",
  kind: "pickup" as const,
  sequence: 0,
  polyline_index: 0,
  lat: "37.5407",
  lon: "-77.436",
  label: "Richmond, VA",
  scheduled_at: "2026-05-21T14:15:00-04:00",
  duration_s: 3600,
};

const VALID_EVENT = {
  id: "00000000-0000-4000-8000-000000000020",
  sequence: 0,
  status: "on_duty_not_driving" as const,
  start: "2026-05-21T14:00:00-04:00",
  duration_s: 900,
  location: "Richmond, VA",
  note: "Pre-trip inspection",
};

const VALID_DAY = {
  id: "00000000-0000-4000-8000-000000000030",
  date: "2026-05-21",
  off_duty_s: 0,
  sleeper_s: 0,
  driving_s: 22500,
  on_duty_not_driving_s: 8100,
  total_miles: "342.7",
};

const VALID_PLAN = {
  trip_id: "00000000-0000-4000-8000-000000000001",
  start_at: "2026-05-21T14:00:00-04:00",
  home_terminal_tz: "America/New_York",
  stops: [VALID_STOP],
  events: [VALID_EVENT],
  days: [VALID_DAY],
};

describe("tripStopSchema", () => {
  it("coerces decimal-string lat/lon to numbers", () => {
    const parsed = tripStopSchema.parse(VALID_STOP);

    expect(parsed.lat).toBe(37.5407);
    expect(parsed.lon).toBe(-77.436);
  });

  it("rejects unknown stop kinds", () => {
    expect(() => tripStopSchema.parse({ ...VALID_STOP, kind: "lunch" })).toThrow();
  });

  it("rejects naive datetimes without offset", () => {
    expect(() =>
      tripStopSchema.parse({ ...VALID_STOP, scheduled_at: "2026-05-21T14:15:00" }),
    ).toThrow();
  });
});

describe("logEventSchema", () => {
  it("rejects unknown duty statuses", () => {
    expect(() => logEventSchema.parse({ ...VALID_EVENT, status: "personal_conveyance" })).toThrow();
  });
});

describe("logDaySchema", () => {
  it("coerces decimal-string total_miles to a number", () => {
    const parsed = logDaySchema.parse(VALID_DAY);

    expect(parsed.total_miles).toBe(342.7);
  });

  it("requires an ISO date for the date field", () => {
    expect(() => logDaySchema.parse({ ...VALID_DAY, date: "05/21/2026" })).toThrow();
  });
});

describe("stopKindSchema", () => {
  it("enumerates the six BE stop kinds", () => {
    const kinds = ["pickup", "dropoff", "fuel", "break", "sleeper", "restart"];

    for (const kind of kinds) {
      expect(stopKindSchema.parse(kind)).toBe(kind);
    }
  });
});

describe("tripPlanSchema", () => {
  it("parses the full envelope shape", () => {
    const parsed = tripPlanSchema.parse(VALID_PLAN);

    expect(parsed.trip_id).toBe(VALID_PLAN.trip_id);
    expect(parsed.home_terminal_tz).toBe("America/New_York");
    expect(parsed.stops).toHaveLength(1);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.days).toHaveLength(1);
  });

  it("rejects an empty home_terminal_tz", () => {
    expect(() => tripPlanSchema.parse({ ...VALID_PLAN, home_terminal_tz: "" })).toThrow();
  });
});
