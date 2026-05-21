import { http, HttpResponse } from "msw";

import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";

const BASE = "http://localhost:8000";

interface PeliasFeature {
  label: string;
  country_a: string | null;
  region_a: string | null;
  locality: string | null;
  confidence: number | null;
  match_type: string | null;
  lat: number;
  lon: number;
}

export function feature(label: string, lat: number, lon: number): PeliasFeature {
  return {
    label,
    country_a: "USA",
    region_a: "VA",
    locality: label.split(",")[0] ?? null,
    confidence: 0.93,
    match_type: "exact",
    lat,
    lon,
  };
}

export const DEFAULT_FEATURES: PeliasFeature[] = [
  feature("Richmond, VA, USA", 37.5407, -77.436),
  feature("Richmond Heights, OH, USA", 41.5572, -81.5023),
];

const DEFAULT_TRIP_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_CREATED_AT = "2026-05-20T00:00:00Z";
// A fixed driver-chosen shift start in the home-terminal time zone. The
// envelope reads this back unchanged so view tests can assert the "Departs"
// formatting deterministically.
const DEFAULT_START_AT = "2026-05-21T14:00:00-04:00";

function tripShape(overrides?: Partial<TripResponse>): TripResponse {
  const base: TripResponse = {
    id: DEFAULT_TRIP_ID,
    created_at: DEFAULT_CREATED_AT,
    start_at: DEFAULT_START_AT,
    current_label: "Richmond, VA",
    current_lat: 37.5407,
    current_lon: -77.436,
    pickup_label: "Fredericksburg, VA",
    pickup_lat: 38.3032,
    pickup_lon: -77.4605,
    dropoff_label: "Newark, NJ",
    dropoff_lat: 40.7357,
    dropoff_lon: -74.1724,
    cycle_hours_used: "35.0",
    route_polyline: [
      [-77.436, 37.5407],
      [-77.4605, 38.3032],
      [-74.1724, 40.7357],
    ],
    route_segments: [
      { distance_mi: 67.4, duration_s: 4321, from_index: 0, to_index: 1 },
      { distance_mi: 275.3, duration_s: 14760, from_index: 1, to_index: 2 },
    ],
    route_summary: { distance_mi: 342.7, duration_s: 19080 },
  };
  return { ...base, ...overrides };
}

export function mockTripPlanned(overrides?: Partial<TripResponse>) {
  return http.get(`${BASE}/api/trips/:id/`, ({ params }) =>
    HttpResponse.json(tripShape({ ...overrides, id: String(params.id) })),
  );
}

// Default plan envelope shape modelled on the spec-05 `assessment_simple`
// golden trip (Richmond → Fredericksburg → Newark, ~342 mi, ~8.5h elapsed).
// Two TripStops (pickup + dropoff), seven LogEvents, one LogDay. Decimal
// fields ship as strings to mirror DRF serialization.
function samplePlanShape(tripId?: string, overrides?: Partial<TripPlan>): TripPlan {
  const id = tripId ?? DEFAULT_TRIP_ID;
  const base: TripPlan = {
    trip_id: id,
    start_at: DEFAULT_START_AT,
    home_terminal_tz: "America/New_York",
    stops: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        kind: "pickup",
        sequence: 0,
        polyline_index: 1,
        lat: 38.3032,
        lon: -77.4605,
        label: "Fredericksburg, VA",
        scheduled_at: "2026-05-21T15:30:00-04:00",
        duration_s: 3600,
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        kind: "dropoff",
        sequence: 1,
        polyline_index: 2,
        lat: 40.7357,
        lon: -74.1724,
        label: "Newark, NJ",
        scheduled_at: "2026-05-21T21:30:00-04:00",
        duration_s: 3600,
      },
    ],
    events: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        sequence: 0,
        status: "on_duty_not_driving",
        start: "2026-05-21T14:00:00-04:00",
        duration_s: 900,
        location: "Richmond, VA",
        note: "Pre-trip inspection",
      },
      {
        id: "00000000-0000-4000-8000-000000000202",
        sequence: 1,
        status: "driving",
        start: "2026-05-21T14:15:00-04:00",
        duration_s: 4500,
        location: "Richmond, VA",
        note: "En route",
      },
      {
        id: "00000000-0000-4000-8000-000000000203",
        sequence: 2,
        status: "on_duty_not_driving",
        start: "2026-05-21T15:30:00-04:00",
        duration_s: 3600,
        location: "Fredericksburg, VA",
        note: "Pickup",
      },
      {
        id: "00000000-0000-4000-8000-000000000204",
        sequence: 3,
        status: "driving",
        start: "2026-05-21T16:30:00-04:00",
        duration_s: 18000,
        location: "Fredericksburg, VA",
        note: "En route",
      },
      {
        id: "00000000-0000-4000-8000-000000000205",
        sequence: 4,
        status: "on_duty_not_driving",
        start: "2026-05-21T21:30:00-04:00",
        duration_s: 3600,
        location: "Newark, NJ",
        note: "Dropoff",
      },
    ],
    days: [
      {
        id: "00000000-0000-4000-8000-000000000301",
        date: "2026-05-21",
        off_duty_s: 0,
        sleeper_s: 0,
        driving_s: 22500,
        on_duty_not_driving_s: 8100,
        total_miles: 342.7,
      },
    ],
  };
  return { ...base, ...overrides };
}

export function mockTripPlan(overrides?: Partial<TripPlan>) {
  return http.get(`${BASE}/api/trips/:id/plan/`, ({ params }) =>
    HttpResponse.json(samplePlanShape(String(params.id), overrides)),
  );
}

// Multi-day plan variant for spec 08 strip tests. Mirrors a LA → Albuquerque
// 3-day shape with realistic per-status totals on each day. Opt-in via
// `mockTripPlan(MULTI_DAY_PLAN_OVERRIDES)` — keeps the single-day default for
// the spec-07 tests.
export const MULTI_DAY_PLAN_OVERRIDES: Partial<TripPlan> = {
  home_terminal_tz: "America/Los_Angeles",
  days: [
    {
      id: "00000000-0000-4000-8000-000000000311",
      date: "2026-05-21",
      off_duty_s: 0,
      sleeper_s: 0,
      driving_s: 39_600, // 11h
      on_duty_not_driving_s: 7_200,
      total_miles: 612.4,
    },
    {
      id: "00000000-0000-4000-8000-000000000312",
      date: "2026-05-22",
      off_duty_s: 36_000, // 10h off-duty
      sleeper_s: 0,
      driving_s: 39_600,
      on_duty_not_driving_s: 10_800,
      total_miles: 620.0,
    },
    {
      id: "00000000-0000-4000-8000-000000000313",
      date: "2026-05-23",
      off_duty_s: 36_000,
      sleeper_s: 0,
      driving_s: 36_000,
      on_duty_not_driving_s: 14_400,
      total_miles: 580.2,
    },
  ],
  stops: [
    {
      id: "00000000-0000-4000-8000-000000000111",
      kind: "pickup",
      sequence: 0,
      polyline_index: 1,
      lat: 34.0522,
      lon: -118.2437,
      label: "Los Angeles, CA",
      scheduled_at: "2026-05-21T15:00:00-07:00",
      duration_s: 3600,
    },
    {
      id: "00000000-0000-4000-8000-000000000112",
      kind: "dropoff",
      sequence: 1,
      polyline_index: 5,
      lat: 35.0844,
      lon: -106.6504,
      label: "Albuquerque, NM",
      scheduled_at: "2026-05-23T17:00:00-06:00",
      duration_s: 3600,
    },
  ],
  events: [
    {
      id: "00000000-0000-4000-8000-000000000211",
      sequence: 0,
      status: "on_duty_not_driving",
      start: "2026-05-21T14:00:00-07:00",
      duration_s: 1800,
      location: "Los Angeles, CA",
      note: "Pre-trip inspection",
    },
    {
      id: "00000000-0000-4000-8000-000000000212",
      sequence: 1,
      status: "driving",
      start: "2026-05-21T14:30:00-07:00",
      duration_s: 39_600,
      location: "Los Angeles, CA",
      note: "En route",
    },
  ],
};

export const handlers = [
  http.get(`${BASE}/api/geocode/autocomplete/`, ({ request }) => {
    const url = new URL(request.url);
    const text = url.searchParams.get("text") ?? "";
    if (text === "") {
      return HttpResponse.json(
        { detail: "Validation failed.", errors: { text: ["This field is required."] } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ features: DEFAULT_FEATURES });
  }),

  http.get(`${BASE}/api/geocode/search/`, ({ request }) => {
    const url = new URL(request.url);
    const text = url.searchParams.get("text") ?? "";
    if (text === "") {
      return HttpResponse.json(
        { detail: "Validation failed.", errors: { text: ["This field is required."] } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ features: DEFAULT_FEATURES.slice(0, 1) });
  }),

  http.post(`${BASE}/api/trips/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      tripShape({
        current_label: (body.current as { label: string }).label,
        current_lat: (body.current as { lat: number }).lat,
        current_lon: (body.current as { lon: number }).lon,
        pickup_label: (body.pickup as { label: string }).label,
        pickup_lat: (body.pickup as { lat: number }).lat,
        pickup_lon: (body.pickup as { lon: number }).lon,
        dropoff_label: (body.dropoff as { label: string }).label,
        dropoff_lat: (body.dropoff as { lat: number }).lat,
        dropoff_lon: (body.dropoff as { lon: number }).lon,
        cycle_hours_used: String(body.cycle_hours_used),
        start_at: typeof body.start_at === "string" ? body.start_at : DEFAULT_START_AT,
      }),
      { status: 201 },
    );
  }),

  http.get(`${BASE}/api/trips/:id/`, ({ params }) =>
    HttpResponse.json(tripShape({ id: String(params.id) })),
  ),

  mockTripPlan(),
];
