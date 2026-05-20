import { http, HttpResponse } from "msw";

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
      {
        id: "00000000-0000-4000-8000-000000000001",
        status: "pending",
        created_at: "2026-05-19T00:00:00Z",
        current_label: (body.current as { label: string }).label,
        current_lat: (body.current as { lat: number }).lat,
        current_lon: (body.current as { lon: number }).lon,
        pickup_label: (body.pickup as { label: string }).label,
        pickup_lat: (body.pickup as { lat: number }).lat,
        pickup_lon: (body.pickup as { lon: number }).lon,
        dropoff_label: (body.dropoff as { label: string }).label,
        dropoff_lat: (body.dropoff as { lat: number }).lat,
        dropoff_lon: (body.dropoff as { lon: number }).lon,
        cycle_hours_used: body.cycle_hours_used,
      },
      { status: 201 },
    );
  }),

  http.get(`${BASE}/api/trips/:id/`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: "pending",
      created_at: "2026-05-19T00:00:00Z",
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
    });
  }),
];
