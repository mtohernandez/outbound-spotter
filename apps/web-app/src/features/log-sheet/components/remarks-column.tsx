import {
  GRID_HEIGHT,
  GRID_WIDTH,
  GRID_X,
  GRID_Y,
  REMARKS_HEIGHT,
  REMARKS_Y,
} from "@/features/log-sheet/components/grid-geometry";
import type { EventFragment } from "@/features/log-sheet/utils/events-by-day";
import {
  firstDrivingSequence,
  lookupEventLocation,
  type TripLabels,
} from "@/features/log-sheet/utils/lookup-event-location";
import type { LogEvent, TripStop } from "@/features/trip-planner/schemas/trip-plan";

interface RemarksColumnProps {
  readonly fragments: readonly EventFragment[];
  // Full per-trip events list — `firstDrivingSequence` is computed across the
  // entire trip, not just the current day's fragments.
  readonly events: readonly LogEvent[];
  readonly stops: readonly TripStop[];
  readonly trip: TripLabels;
}

const LEADER_LENGTH = 28;
const LABEL_BASELINE_Y = REMARKS_Y + LEADER_LENGTH + 4;
const ROTATION_DEG = -60;

// City/state callouts below the grid at each duty-status change.
//
// Topology (matches docs/assets/example-complete-grid.png): a thin vertical
// leader line drops from the grid bottom (GRID_Y + GRID_HEIGHT) for ~28 px,
// then the city/state label is anchored at the leader tip and rotated -60°
// counterclockwise so the text reads at a comfortable angle. The leader
// length stays constant; only the x-coordinate varies.
//
// A fragment that started on a previous day (`startsBefore`) gets no callout
// (the duty change already appeared on the prior day's sheet).
export function RemarksColumn({
  fragments,
  events,
  stops,
  trip,
}: RemarksColumnProps): React.ReactElement {
  const firstDrivingSeq = firstDrivingSequence(events);
  const labels = fragments
    .filter((fragment) => !fragment.startsBefore)
    .map((fragment) => ({
      key: `${fragment.event.id}-${fragment.startX}`,
      x: GRID_X + fragment.startX,
      label: lookupEventLocation({
        event: fragment.event,
        trip,
        stops,
        firstDrivingEventSequence: firstDrivingSeq,
      }),
    }));

  return (
    <g data-slot="remarks-column" stroke="currentColor" fill="currentColor">
      <line
        x1={GRID_X}
        y1={REMARKS_Y}
        x2={GRID_X}
        y2={REMARKS_Y + REMARKS_HEIGHT}
        strokeWidth={0.6}
      />
      <line
        x1={GRID_X}
        y1={REMARKS_Y + REMARKS_HEIGHT - 1}
        x2={GRID_X + GRID_WIDTH}
        y2={REMARKS_Y + REMARKS_HEIGHT - 1}
        strokeWidth={0.6}
      />
      <text
        x={GRID_X - 6}
        y={REMARKS_Y + 12}
        textAnchor="end"
        fontFamily="var(--font-sans)"
        fontSize={10}
        fontWeight={500}
        stroke="none"
      >
        Remarks
      </text>
      {labels.map(({ key, x, label }) => (
        <g key={key} data-slot="remark">
          <line
            x1={x}
            y1={GRID_Y + GRID_HEIGHT}
            x2={x}
            y2={REMARKS_Y + LEADER_LENGTH}
            strokeWidth={0.6}
            opacity={0.7}
          />
          <text
            x={x}
            y={LABEL_BASELINE_Y}
            transform={`rotate(${ROTATION_DEG} ${x} ${LABEL_BASELINE_Y})`}
            textAnchor="start"
            fontFamily="var(--font-mono)"
            fontSize={9}
            stroke="none"
          >
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}
