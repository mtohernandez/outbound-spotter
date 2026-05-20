import L from "leaflet";

import { STOP_TYPE_CLASSNAMES } from "@/features/trip-planner/components/map/stop-type-colors";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

const ICON_SIZE = 28;
const ICON_ANCHOR_Y = 28;

// Per-kind SVG path data (24×24 viewBox, fill="currentColor"). Shapes are
// distinguishable beyond color so colorblind users still tell stops apart.
// Geometry is hand-cleaned from Lucide source where possible.
const ICON_PATHS = {
  // pickup — upward triangle (load taken on)
  pickup: "M12 2 22 20 H2 Z",
  // dropoff — map pin (destination)
  dropoff:
    "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 6.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z",
  // fuel — fuel pump
  fuel: "M3 22V4a2 2 0 012-2h9a2 2 0 012 2v18H3zm14-12h2a2 2 0 012 2v6a1 1 0 11-2 0v-5h-2v-3z",
  // break — coffee mug (30-min break)
  break:
    "M6 4a2 2 0 012-2h8a2 2 0 012 2v3a4 4 0 01-4 4h-4a4 4 0 01-4-4V4zm-2 14h16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z",
  // sleeper — bed (sleeper berth, 10h)
  sleeper: "M2 18V8h6a4 4 0 014 4v2h10v4H2zm4-9a3 3 0 110 6 3 3 0 010-6z",
  // restart — circular arrow (34h restart)
  restart: "M12 4V1L7 6l5 5V7a5 5 0 11-5 5H5a7 7 0 107-7zm1 6h-2v4h4v-2h-2v-2z",
} as const satisfies Record<StopKind, string>;

function makeIcon(kind: StopKind): L.DivIcon {
  // CSP-safe: no inline `style` attribute. The color comes from the
  // .trip-marker__icon--{kind} class defined in packages/ui/src/styles/globals.css.
  const html = `<span class="trip-marker__icon ${STOP_TYPE_CLASSNAMES[kind]}"><svg width="${String(ICON_SIZE)}" height="${String(ICON_SIZE)}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICON_PATHS[kind]}"/></svg></span>`;
  return L.divIcon({
    html,
    className: "trip-marker",
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2, ICON_ANCHOR_Y],
    popupAnchor: [0, -ICON_ANCHOR_Y],
  });
}

// One DivIcon per kind, reused across every marker render. Stable identity
// keeps react-leaflet from running `marker.setIcon()` on each re-render (which
// rebuilds the marker's DOM and closes any open popup).
const ICON_REGISTRY: Record<StopKind, L.DivIcon> = {
  pickup: makeIcon("pickup"),
  dropoff: makeIcon("dropoff"),
  fuel: makeIcon("fuel"),
  break: makeIcon("break"),
  sleeper: makeIcon("sleeper"),
  restart: makeIcon("restart"),
};

export function buildMarkerIcon(kind: StopKind): L.DivIcon {
  return ICON_REGISTRY[kind];
}
