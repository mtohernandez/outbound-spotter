import { Marker, Popup } from "react-leaflet";

import { buildMarkerIcon } from "@/features/trip-planner/components/map/marker-icons";
import { MarkerPopup } from "@/features/trip-planner/components/map/marker-popup";
import type { TripStop } from "@/features/trip-planner/schemas/trip-plan";

interface Props {
  readonly stop: TripStop;
  readonly tz: string;
}

export function StopMarker({ stop, tz }: Props): React.ReactElement {
  return (
    <Marker
      position={[stop.lat, stop.lon]}
      icon={buildMarkerIcon(stop.kind)}
      // Explicit per spec decision 15 — don't rely on Leaflet 1.9.4's default.
      keyboard
    >
      <Popup className="leaflet-popup-themed">
        <MarkerPopup stop={stop} tz={tz} />
      </Popup>
    </Marker>
  );
}
