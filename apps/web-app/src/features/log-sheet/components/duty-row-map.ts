import type { DutyStatus } from "@/features/trip-planner/schemas/trip-plan";

// Row order on the FMCSA §395.8 graph grid, top to bottom. Pinned here so a
// future DutyStatus enum extension fails type-check in exactly one place.
export const DUTY_ROW_INDEX: Record<DutyStatus, 0 | 1 | 2 | 3> = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
};

export const DUTY_ROW_LABELS: Record<DutyStatus, string> = {
  off_duty: "Off Duty",
  sleeper_berth: "Sleeper Berth",
  driving: "Driving",
  on_duty_not_driving: "On Duty (Not Driving)",
};
