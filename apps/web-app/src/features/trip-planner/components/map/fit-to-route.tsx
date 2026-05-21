import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

interface Props {
  // Leaflet ordering: [lat, lon]. Caller (`<TripMap />`) does the swap once.
  readonly positions: readonly (readonly [number, number])[];
}

// Fits the map to the route exactly once per mount. The `fittedRef` guard is
// the source of truth (not a dep-array trick) so refactors that swap effect
// libraries or rename props can't silently break the contract. Pan/zoom
// interactions never re-fit — the user's view intent is sovereign (spec
// decision 7 / architect-review M1).
export function FitToRoute({ positions }: Props): null {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || positions.length === 0) return;
    const latLngs = positions.map(([lat, lng]) => L.latLng(lat, lng));
    map.fitBounds(L.latLngBounds(latLngs), { padding: [48, 48] });
    fittedRef.current = true;
  }, [map, positions]);
  return null;
}
