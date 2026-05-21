import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

// Geometry shared by the Leaflet DivIcon (map) and the inline StopKindIcon
// (sidebar). Same shape + same alignment = an unambiguous visual link between
// the sidebar row and the map marker.
//
// 24×30 viewBox:
//   - Outer teardrop: M12 0 → arc clockwise → bottom point at (12,30)
//   - Inner glyph: 11×11 square centred at (12,12) inside the pin head.
export const PIN_OUTLINE =
  "M12 0C5.4 0 0 5.4 0 12c0 7.5 9.7 16.6 11.3 18 .4.3 1 .3 1.4 0C14.3 28.6 24 19.5 24 12 24 5.4 18.6 0 12 0Z";

export const INNER_GLYPHS: Record<StopKind, string> = {
  // pickup — upward chevron (load taken on)
  pickup: "M12 6.5 7.5 13.5h2.5V17h4v-3.5h2.5z",
  // dropoff — downward chevron (load delivered)
  dropoff: "M12 17.5 7.5 10.5h2.5V7h4v3.5h2.5z",
  // fuel — droplet
  fuel: "M12 6c-2 2.6-4 5.2-4 7.5a4 4 0 1 0 8 0C16 11.2 14 8.6 12 6Z",
  // break — half-circle clock (30-min break)
  break: "M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 1.5v4l3 1.5",
  // sleeper — crescent moon
  sleeper: "M14.5 6.5a5.5 5.5 0 1 0 3 9.9 4.5 4.5 0 0 1-3-9.9Z",
  // restart — circular arrow (34h reset)
  restart:
    "M12 6.5a5.5 5.5 0 1 1-5.2 7.3l1.5-.5a4 4 0 1 0-.3-3l1.6 1.2H6V7.4l1.6 1.2A5.49 5.49 0 0 1 12 6.5z",
};
