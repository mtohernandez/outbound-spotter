/* eslint-disable react-refresh/only-export-components -- pure factory module */
import L from "leaflet";

import { INNER_GLYPHS, PIN_OUTLINE } from "@/features/trip-planner/components/map/pin-geometry";
import { STOP_TYPE_CLASSNAMES } from "@/features/trip-planner/components/map/stop-type-colors";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

const ICON_WIDTH = 30;
const ICON_HEIGHT = 38;
// Anchor on the pin's tip (bottom-center) so the marker sits exactly on the
// geographic coordinate. The popup anchor matches so the popup tip aligns
// with the pin tip too.
const ICON_ANCHOR_X = ICON_WIDTH / 2;
const ICON_ANCHOR_Y = ICON_HEIGHT;
const POPUP_ANCHOR_Y = -ICON_HEIGHT + 4;

function buildHtml(kind: StopKind): string {
  // Two stacked <path>s: the outer teardrop (filled currentColor) + the inner
  // glyph (filled white). CSP-safe — no inline style attribute.
  return [
    `<span class="trip-marker__icon ${STOP_TYPE_CLASSNAMES[kind]}" aria-hidden="true">`,
    `<svg width="${String(ICON_WIDTH)}" height="${String(ICON_HEIGHT)}" viewBox="0 0 24 30" fill="currentColor">`,
    `<path d="${PIN_OUTLINE}"/>`,
    `<path d="${INNER_GLYPHS[kind]}" fill="white" stroke="white" stroke-width="0.6" stroke-linejoin="round"/>`,
    `</svg>`,
    `</span>`,
  ].join("");
}

function makeIcon(kind: StopKind): L.DivIcon {
  return L.divIcon({
    html: buildHtml(kind),
    className: "trip-marker",
    iconSize: [ICON_WIDTH, ICON_HEIGHT],
    iconAnchor: [ICON_ANCHOR_X, ICON_ANCHOR_Y],
    popupAnchor: [0, POPUP_ANCHOR_Y],
  });
}

// One DivIcon per kind, reused across every marker render. Stable identity
// keeps react-leaflet from running marker.setIcon() (DOM rebuild that closes
// any open popup) on each re-render.
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
