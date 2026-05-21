import { useEffect, useRef } from "react";
import { Marker, Popup } from "react-leaflet";

import { buildMarkerIcon } from "@/features/trip-planner/components/map/marker-icons";
import { MarkerPopup } from "@/features/trip-planner/components/map/marker-popup";
import type { TripStop } from "@/features/trip-planner/schemas/trip-plan";
import { setHoveredStop } from "@/features/trip-planner/state/hovered-stop";

import type { Marker as LeafletMarker } from "leaflet";

interface Props {
  readonly stop: TripStop;
  readonly tz: string;
  readonly isHovered: boolean;
}

export function StopMarker({ stop, tz, isHovered }: Props): React.ReactElement {
  const markerRef = useRef<LeafletMarker | null>(null);

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    el.classList.toggle("trip-marker--is-pulsing", isHovered);
  }, [isHovered]);

  return (
    <Marker
      ref={markerRef}
      position={[stop.lat, stop.lon]}
      icon={buildMarkerIcon(stop.kind)}
      keyboard
      eventHandlers={{
        mouseover: () => {
          setHoveredStop(stop.id);
        },
        mouseout: () => {
          setHoveredStop(null);
        },
      }}
    >
      <Popup className="leaflet-popup-themed">
        <MarkerPopup stop={stop} tz={tz} />
      </Popup>
    </Marker>
  );
}
