import L from "leaflet";

// "You are here" marker for the trip-preview map. Always-on pulse via the
// .current-location-dot CSS rules in packages/ui/src/styles/globals.css.
// Distinct shape (round dot) from the StopKind teardrop pins so the driver
// reads the map at a glance.

const DOT_HTML = `
  <span class="current-location-dot" aria-hidden="true">
    <span class="current-location-dot__pulse"></span>
    <span class="current-location-dot__ring"></span>
    <span class="current-location-dot__core"></span>
  </span>
`.trim();

const ICON_SIZE = 32;
const ICON_ANCHOR = ICON_SIZE / 2;

const CURRENT_LOCATION_ICON: L.DivIcon = L.divIcon({
  html: DOT_HTML,
  className: "current-location",
  iconSize: [ICON_SIZE, ICON_SIZE],
  iconAnchor: [ICON_ANCHOR, ICON_ANCHOR],
  popupAnchor: [0, -ICON_ANCHOR],
});

export function buildCurrentLocationIcon(): L.DivIcon {
  return CURRENT_LOCATION_ICON;
}
