// Common US IANA zones → the friendly label printed alongside the FMCSA
// "Use time standard of home terminal." footer. Unknown zones pass through
// unchanged — better to surface the IANA string than silently rebrand a zone
// outside this lookup.
const TZ_LABELS: Readonly<Record<string, string>> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Phoenix": "Mountain (Arizona, no DST)",
  "America/Los_Angeles": "Pacific",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

export function formatTzLabel(timeZone: string): string {
  return TZ_LABELS[timeZone] ?? timeZone;
}
