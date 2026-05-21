import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";

import { buildMarkerIcon } from "@/features/trip-planner/components/map/marker-icons";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";
import { isResolved, useTripDraft } from "@/features/trip-planner/state/trip-input-draft";

import type { Map as LeafletMap } from "leaflet";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const FALLBACK_CENTER: [number, number] = [37.7749, -95.4194];
const FALLBACK_ZOOM = 4;
const MAP_ARIA_LABEL =
  "Trip route preview. Fill in current, pickup, and dropoff to see the preview path. Use arrow keys to pan, plus and minus to zoom.";

// "Start" uses pickup color (matches the sidebar StopKindIcon convention so
// the brand stays consistent between the input form and the planned trip).
// Dropoff uses red so the end-of-state is always the visual anchor.
const PREVIEW_KIND_MAP: Record<"current" | "pickup" | "dropoff", StopKind> = {
  current: "pickup",
  pickup: "pickup",
  dropoff: "dropoff",
};

export default function TripPreviewMap(): React.ReactElement {
  const mapRef = useRef<LeafletMap | null>(null);
  const draft = useTripDraft();

  // Build the list of resolved pin positions in route order, swapping to
  // Leaflet's [lat, lon] convention. Only kinds the driver has actually
  // picked render — half-filled forms still show a useful map.
  const pins = useMemo<{ key: string; kind: StopKind; pos: [number, number] }[]>(() => {
    const out: { key: string; kind: StopKind; pos: [number, number] }[] = [];
    for (const slot of ["current", "pickup", "dropoff"] as const) {
      const addr = draft[slot];
      if (!isResolved(addr)) continue;
      out.push({ key: slot, kind: PREVIEW_KIND_MAP[slot], pos: [addr.lat, addr.lon] });
    }
    return out;
  }, [draft]);

  const previewPath = useMemo<[number, number][]>(() => pins.map((p) => p.pos), [pins]);

  // Fit-to-pins whenever the set of resolved pins changes — preview is
  // interactive in a different way than the planned map: the driver expects
  // the map to follow the form, not stay frozen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pins.length === 0) {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM, { animate: true });
      return;
    }
    if (pins.length === 1) {
      const only = pins[0];
      if (only) map.setView(only.pos, 9, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => L.latLng(p.pos[0], p.pos[1])));
    map.fitBounds(bounds, { padding: [64, 64], animate: true });
  }, [pins]);

  const setMapRef = useCallback((map: LeafletMap | null) => {
    mapRef.current = map;
    if (map) {
      map.getContainer().setAttribute("aria-label", MAP_ARIA_LABEL);
    }
  }, []);

  return (
    <div className="relative size-full">
      <MapContainer
        ref={setMapRef}
        className="bg-background size-full"
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        {previewPath.length >= 2 ? (
          <Polyline
            positions={previewPath}
            pathOptions={{
              color: "var(--teal-600)",
              weight: 3,
              opacity: 0.55,
              dashArray: "6 6",
              lineCap: "round",
            }}
          />
        ) : null}
        {pins.map((p) => (
          <Marker key={p.key} position={p.pos} icon={buildMarkerIcon(p.kind)} keyboard={false} />
        ))}
      </MapContainer>
      {pins.length === 0 ? (
        <div className="bg-background/70 supports-backdrop-filter:bg-background/40 pointer-events-none absolute inset-0 flex items-center justify-center backdrop-blur-sm">
          <div className="pointer-events-auto max-w-sm text-center">
            <p className="font-display text-lg font-medium tracking-tight">Plan your trip</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Fill the three addresses on the left to see a preview here. Once you submit, the
              routed map and FMCSA daily logs appear.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
