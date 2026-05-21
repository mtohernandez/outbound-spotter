import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";

import { buildCurrentLocationIcon } from "@/features/trip-planner/components/map/current-location-icon";
import { buildMarkerIcon } from "@/features/trip-planner/components/map/marker-icons";
import { isResolved, useTripDraft } from "@/features/trip-planner/state/trip-input-draft";

import type { DivIcon, Map as LeafletMap } from "leaflet";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const FALLBACK_CENTER: [number, number] = [37.7749, -95.4194];
const FALLBACK_ZOOM = 4;
const MAP_ARIA_LABEL =
  "Trip route preview. Fill in current, pickup, and dropoff to see the preview path. Use arrow keys to pan, plus and minus to zoom.";

type PreviewSlot = "current" | "pickup" | "dropoff";

// Each input slot picks its own visual: the current location is the "you are
// here" pulsing dot (no pin tip — drivers shouldn't confuse it with the
// pickup or dropoff stop), pickup is the teal teardrop pin, dropoff is the
// red teardrop pin.
function iconForSlot(slot: PreviewSlot): DivIcon {
  if (slot === "current") return buildCurrentLocationIcon();
  return buildMarkerIcon(slot);
}

export default function TripPreviewMap(): React.ReactElement {
  const mapRef = useRef<LeafletMap | null>(null);
  const draft = useTripDraft();

  // Build the list of resolved pin positions in route order, swapping to
  // Leaflet's [lat, lon] convention. Only slots the driver has actually
  // picked render — half-filled forms still show a useful map.
  const pins = useMemo<{ key: PreviewSlot; pos: [number, number]; icon: DivIcon }[]>(() => {
    const out: { key: PreviewSlot; pos: [number, number]; icon: DivIcon }[] = [];
    for (const slot of ["current", "pickup", "dropoff"] as const) {
      const addr = draft[slot];
      if (!isResolved(addr)) continue;
      out.push({ key: slot, pos: [addr.lat, addr.lon], icon: iconForSlot(slot) });
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
          <Marker key={p.key} position={p.pos} icon={p.icon} keyboard={false} />
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
