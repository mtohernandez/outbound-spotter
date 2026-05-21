import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

// Per-kind class names rendered into the marker HTML AND used on the popup
// Badge so the chip border matches the marker color via `currentColor` cascade
// (.trip-marker__icon--{kind} sets `color` in packages/ui/src/styles/globals.css).
export const STOP_TYPE_CLASSNAMES = {
  pickup: "trip-marker__icon--pickup",
  dropoff: "trip-marker__icon--dropoff",
  fuel: "trip-marker__icon--fuel",
  break: "trip-marker__icon--break",
  sleeper: "trip-marker__icon--sleeper",
  restart: "trip-marker__icon--restart",
} as const satisfies Record<StopKind, string>;

// Documents the theme token each .trip-marker__icon--{kind} class resolves to.
// A fixture-stylesheet test asserts the CSS rules match (drift detection).
// Palette intent (see `docs/theme.md`):
//   pickup   teal-500  bright + active (load acquired)
//   dropoff  red-500   the brand's lone red, reserved for "end of state"
//   fuel     teal-300  light + repeated
//   break    teal-400  mid (planner-inserted, regulatory)
//   sleeper  teal-700  dark (long pause)
//   restart  teal-800  darkest (rare, 34h)
export const STOP_TYPE_TOKENS = {
  pickup: "--teal-500",
  dropoff: "--red-500",
  fuel: "--teal-300",
  break: "--teal-400",
  sleeper: "--teal-700",
  restart: "--teal-800",
} as const satisfies Record<StopKind, string>;
