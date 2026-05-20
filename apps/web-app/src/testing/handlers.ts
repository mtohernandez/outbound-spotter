import { http, HttpResponse } from "msw";

import type { RouteErrorCode, TripResponse } from "@/features/trip-planner/schemas/trip-response";

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

function plannedShape(overrides?: Partial<TripResponse>): TripResponse {
  const base = {
    id: DEFAULT_TRIP_ID,
    status: "planned" as const,
    created_at: DEFAULT_CREATED_AT,
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
    route_error_code: null,
  } satisfies TripResponse;
  return { ...base, ...overrides } as TripResponse;
}

function planningShape(): TripResponse {
  return {
    id: DEFAULT_TRIP_ID,
    status: "planning",
    created_at: DEFAULT_CREATED_AT,
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
    route_polyline: null,
    route_segments: null,
    route_summary: null,
    route_error_code: null,
  };
}

function failedShape(reason: RouteErrorCode = "upstream"): TripResponse {
  return {
    id: DEFAULT_TRIP_ID,
    status: "failed",
    created_at: DEFAULT_CREATED_AT,
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
    route_polyline: null,
    route_segments: null,
    route_summary: null,
    route_error_code: reason,
  };
}

export function mockTripPlanned(overrides?: Partial<TripResponse>) {
  return http.get(`${BASE}/api/trips/:id/`, ({ params }) =>
    HttpResponse.json(plannedShape({ ...overrides, id: String(params.id) })),
  );
}

export function mockTripPlanning() {
  return http.get(`${BASE}/api/trips/:id/`, ({ params }) =>
    HttpResponse.json({ ...planningShape(), id: String(params.id) }),
  );
}

export function mockTripFailed(reason: RouteErrorCode = "upstream") {
  return http.get(`${BASE}/api/trips/:id/`, ({ params }) =>
    HttpResponse.json({ ...failedShape(reason), id: String(params.id) }),
  );
}

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
      plannedShape({
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
      }),
      { status: 201 },
    );
  }),

  http.get(`${BASE}/api/trips/:id/`, ({ params }) =>
    HttpResponse.json(plannedShape({ id: String(params.id) })),
  ),
];
