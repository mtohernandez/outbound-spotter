export const NOT_FOUND_TITLE = "We couldn't find that page";
export const NOT_FOUND_DESCRIPTION =
  "The link you followed may be broken, or the page may have been moved.";

export const APP_ERROR_TITLE = "Something went wrong";
export const APP_ERROR_DESCRIPTION =
  "An unexpected error stopped the app from loading. Reloading usually clears it.";

export const ROUTE_ERROR_TITLE = "Couldn't load this page";
export const ROUTE_ERROR_DESCRIPTION =
  "Something broke while opening this page. Reloading usually clears it.";

export const FEATURE_ERROR_TITLE = "Couldn't load this section";
export const FEATURE_ERROR_DESCRIPTION =
  "Something broke while rendering this section. Reload to try again.";

// Verbatim assumptions from docs/assesment.md:17-20 plus the v1-scope US
// constraint from project-overview.md.
export const TRIP_ASSUMPTIONS: readonly string[] = [
  "Property-carrying driver, 70hrs/8days, no adverse driving conditions.",
  "Fueling at least once every 1,000 miles.",
  "1 hour for pickup and drop-off.",
  "US interstate routes.",
] as const;

export const PLANNING_DISCLAIMER =
  "This is a planning tool, not an ELD. Consult your carrier's FMCSA-certified ELD for the legal record.";
