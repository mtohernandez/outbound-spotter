import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

interface StopKindMeta {
  readonly label: string;
  // §395 explainer for planner-inserted stops. Empty for driver-input stops
  // (pickup/dropoff/fuel) where the reason is obvious from the label.
  readonly reason: string;
}

export const STOP_KIND_META = {
  pickup: {
    label: "Pickup",
    reason: "1 hr on-duty (not driving) — assignment brief assumes 1 hour for pickup.",
  },
  dropoff: {
    label: "Dropoff",
    reason: "1 hr on-duty (not driving) — assignment brief assumes 1 hour for drop-off.",
  },
  fuel: {
    label: "Fuel stop",
    reason:
      "On-duty (not driving) — assignment brief assumes fueling at least once every 1,000 miles.",
  },
  break: {
    label: "30-min break",
    reason: "§395.3(a)(3)(ii) — required after 8 cumulative driving hours",
  },
  sleeper: {
    label: "Sleeper berth",
    reason: "§395.3(a)(1) — 10-hour off-duty equivalent",
  },
  restart: {
    label: "34-hour restart",
    reason: "§395.3(c)(1) — resets the 70/8 cycle",
  },
} as const satisfies Record<StopKind, StopKindMeta>;
