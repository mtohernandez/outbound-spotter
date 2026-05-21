// Inline-React variant of the "you are here" pulsing dot for the sidebar
// Start row. Shape + animation match the Leaflet DivIcon in
// current-location-icon.ts via the shared .current-location-dot CSS rules.
export function CurrentLocationDot({
  className,
}: {
  readonly className?: string;
}): React.ReactElement {
  return (
    <span className={`current-location-dot ${className ?? ""}`} aria-hidden="true">
      <span className="current-location-dot__pulse" />
      <span className="current-location-dot__ring" />
      <span className="current-location-dot__core" />
    </span>
  );
}
