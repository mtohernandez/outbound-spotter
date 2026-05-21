import { Polyline } from "react-leaflet";

import type { LatLngTuple } from "leaflet";

interface Props {
  // Pre-swapped [lat, lon] tuples. The lon↔lat swap from ORS's GeoJSON order
  // happens once in <TripMap />; this component just renders.
  readonly positions: readonly LatLngTuple[];
}

export function RoutePolyline({ positions }: Props): React.ReactElement {
  return (
    <Polyline
      positions={positions as LatLngTuple[]}
      pathOptions={{
        color: "var(--teal-600)",
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }}
    />
  );
}
