import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

interface StopKindMeta {
  readonly label: string;
  // §395 explainer for planner-inserted stops. Empty for driver-input stops
  // (pickup/dropoff/fuel) where the reason is obvious from the label.
  readonly reason: string;
}

export const STOP_KIND_META = {
  pickup: { label: "Pickup", reason: "" },
  dropoff: { label: "Dropoff", reason: "" },
  fuel: { label: "Fuel stop", reason: "" },
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
