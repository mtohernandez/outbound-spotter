import "leaflet/dist/leaflet.css";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import { buildCurrentLocationIcon } from "@/features/trip-planner/components/map/current-location-icon";
import { FitToRoute } from "@/features/trip-planner/components/map/fit-to-route";
import { RecenterControl } from "@/features/trip-planner/components/map/recenter-control";
import { RoutePolyline } from "@/features/trip-planner/components/map/route-polyline";
import { StopMarker } from "@/features/trip-planner/components/map/stop-marker";
import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
import { useHoveredStopId } from "@/features/trip-planner/state/hovered-stop";
import { isModifierKey } from "@/features/trip-planner/utils/keyboard";

import type { Map as LeafletMap } from "leaflet";

interface Props {
  readonly trip: TripResponse;
  readonly plan: TripPlan;
  readonly active?: boolean;
}

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Fallback center used for the millisecond before <FitToRoute /> kicks in.
// Continental US, eyeballed.
const FALLBACK_CENTER: [number, number] = [37.7749, -95.4194];
const FALLBACK_ZOOM = 4;

const MAP_ARIA_LABEL =
  "Trip route map. Use arrow keys to pan, plus and minus to zoom, R to recenter, Tab to step through stops.";

export default function TripMap({ trip, plan, active = true }: Props): React.ReactElement {
  const mapRef = useRef<LeafletMap | null>(null);
  const hoveredStopId = useHoveredStopId();

  // Pre-swap [lon, lat] (GeoJSON / ORS) → [lat, lon] (Leaflet) once at the
  // top of the tree so children consume the swapped representation. Also lets
  // recenter / FitToRoute read the SAME memoized array — no double allocation.
  const positions = useMemo<[number, number][]>(
    () => trip.route_polyline.map(([lon, lat]) => [lat, lon]),
    [trip.route_polyline],
  );

  // Stable ref so the keydown handler captures `positions` lazily rather than
  // re-binding the listener on every parent re-render (Leaflet tile-load
  // events can cascade re-renders; an unstable listener would thrash).
  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    const pts = positionsRef.current;
    if (!map || pts.length === 0) return;
    map.fitBounds(pts, { padding: [48, 48] });
  }, []);

  // Callback ref: react-leaflet 5's MapContainer forwards the L.Map instance
  // via useImperativeHandle on the second render (after its internal
  // setContext re-render); a plain ref + useEffect([]) would see `null`
  // because the parent's mount effect fires before that second render.
  // The callback also handles the aria-label that MapContainer would
  // otherwise drop (it only spreads {className, id, style} to its wrapper
  // <div>) — spec decision 15.
  const setMapRef = useCallback((map: LeafletMap | null) => {
    mapRef.current = map;
    if (map) {
      map.getContainer().setAttribute("aria-label", MAP_ARIA_LABEL);
    }
  }, []);

  // R-keystroke recenter. Fires when focus is on the map container OR any
  // descendant (markers, popup, attribution); strict identity would break
  // when the user tabs into a marker first. Modifier-key combos (Cmd/Ctrl+R,
  // Alt+R) fall through to the browser / OS.
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (event.key !== "r" && event.key !== "R") return;
      if (isModifierKey(event)) return;
      const map = mapRef.current;
      if (!map) return;
      const container = map.getContainer();
      const active = document.activeElement;
      if (!active || (active !== container && !container.contains(active))) return;
      event.preventDefault();
      recenter();
    }
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [recenter]);

  useEffect(() => {
    if (!active) return;
    const map = mapRef.current;
    if (!map) return;
    const raf = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [active]);

  const currentLocationIcon = useMemo(() => buildCurrentLocationIcon(), []);

  return (
    <div className="relative size-full">
      <MapContainer
        ref={setMapRef}
        className="bg-background size-full"
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        <RoutePolyline positions={positions} />
        <Marker
          position={[trip.current_lat, trip.current_lon]}
          icon={currentLocationIcon}
          keyboard={false}
          interactive={false}
        />
        {plan.stops.map((stop) => (
          <StopMarker
            key={stop.id}
            stop={stop}
            tz={plan.home_terminal_tz}
            isHovered={hoveredStopId === stop.id}
          />
        ))}
        <FitToRoute positions={positions} />
      </MapContainer>
      <RecenterControl onRecenter={recenter} />
    </div>
  );
}
