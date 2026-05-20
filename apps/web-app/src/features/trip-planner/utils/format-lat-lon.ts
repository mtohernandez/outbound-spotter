// Render a "lat, lon" string from numeric coordinates. Used in marker popups
// until reverse-geocoded `TripStop.label` arrives (future spec).
export function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
