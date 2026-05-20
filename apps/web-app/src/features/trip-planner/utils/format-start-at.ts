// WHY: cached at module scope for the common-case home-terminal TZ. tzdata
// staleness across DST transitions requires a tab reload to pick up; that's
// acceptable for v1 (the planner is the source of truth, the FE renders).
const DEFAULT_TZ = "America/New_York";

const DEFAULT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TZ,
});

/**
 * Format an ISO 8601 datetime in the trip's home-terminal time zone.
 *
 * v1 always renders in America/New_York (the planner's home-terminal TZ —
 * see ``hos_adapter.HOME_TERMINAL_TZ``). A future driver-profile spec passes
 * the trip's recorded ``home_terminal_tz`` here so each driver sees their
 * own clock.
 *
 * Returns `"—"` on malformed input so callers don't need a separate guard.
 */
export function formatStartAt(iso: string, timeZone: string = DEFAULT_TZ): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "—";
  if (timeZone === DEFAULT_TZ) return DEFAULT_FORMATTER.format(date);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}
