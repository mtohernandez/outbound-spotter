import { INNER_GLYPHS, PIN_OUTLINE } from "@/features/trip-planner/components/map/pin-geometry";
import { STOP_TYPE_CLASSNAMES } from "@/features/trip-planner/components/map/stop-type-colors";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

// Used by the sidebar StopsList so each row carries the SAME pin shape as
// the map marker — the visual link the senior review asked for.
export function StopKindIcon({
  kind,
  className,
}: {
  readonly kind: StopKind;
  readonly className?: string;
}): React.ReactElement {
  return (
    <span
      className={`trip-marker__icon ${STOP_TYPE_CLASSNAMES[kind]} ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg width="20" height="25" viewBox="0 0 24 30" fill="currentColor">
        <path d={PIN_OUTLINE} />
        <path
          d={INNER_GLYPHS[kind]}
          fill="white"
          stroke="white"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
