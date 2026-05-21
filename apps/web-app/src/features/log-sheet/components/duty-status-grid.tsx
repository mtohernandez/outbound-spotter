import { DUTY_ROW_INDEX, DUTY_ROW_LABELS } from "@/features/log-sheet/components/duty-row-map";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  GRID_X,
  GRID_Y,
  HOUR_WIDTH,
  ROW_HEIGHT,
} from "@/features/log-sheet/components/grid-geometry";
import type { EventFragment } from "@/features/log-sheet/utils/events-by-day";
import type { DutyStatus } from "@/features/trip-planner/schemas/trip-plan";

const HOUR_LABELS: readonly string[] = [
  "Mid",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "Noon",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
];

const DUTY_ORDER: readonly DutyStatus[] = [
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty_not_driving",
];

interface DutyStatusGridProps {
  readonly fragments: readonly EventFragment[];
}

function rowCenterY(status: DutyStatus): number {
  return GRID_Y + DUTY_ROW_INDEX[status] * ROW_HEIGHT + ROW_HEIGHT / 2;
}

// Renders the §395.8 24-hour graph: vertical hour lines, horizontal duty
// rows, 15-minute internal tick marks, hour labels above + below, row labels
// on the left, and the driver's duty-status timeline (horizontal segments +
// vertical transitions). Embedded inside the parent `<svg>` — no nested SVG.
export function DutyStatusGrid({ fragments }: DutyStatusGridProps): React.ReactElement {
  return (
    <g data-slot="duty-status-grid" stroke="currentColor" fill="currentColor">
      {DUTY_ORDER.map((status, rowIndex) => {
        const labelY = GRID_Y + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        return (
          <text
            key={`row-label-${status}`}
            x={GRID_X - 6}
            y={labelY}
            textAnchor="end"
            dominantBaseline="middle"
            fontFamily="var(--font-sans)"
            fontSize={9}
            stroke="none"
          >
            {DUTY_ROW_LABELS[status]}
          </text>
        );
      })}

      {Array.from({ length: 25 }, (_, index) => {
        const x = GRID_X + index * HOUR_WIDTH;
        return (
          <line
            key={`v-line-${index}`}
            x1={x}
            y1={GRID_Y}
            x2={x}
            y2={GRID_Y + GRID_HEIGHT}
            strokeWidth={index % 12 === 0 ? 1.2 : 0.6}
          />
        );
      })}

      {Array.from({ length: 5 }, (_, index) => {
        const y = GRID_Y + index * ROW_HEIGHT;
        return (
          <line
            key={`h-line-${index}`}
            x1={GRID_X}
            y1={y}
            x2={GRID_X + GRID_WIDTH}
            y2={y}
            strokeWidth={index === 0 || index === 4 ? 1.2 : 0.6}
          />
        );
      })}

      {Array.from({ length: 24 }, (_, hour) =>
        [1, 2, 3].map((quarter) => {
          const x = GRID_X + hour * HOUR_WIDTH + (quarter * HOUR_WIDTH) / 4;
          return DUTY_ORDER.map((status) => {
            const rowIndex = DUTY_ROW_INDEX[status];
            const top = GRID_Y + rowIndex * ROW_HEIGHT + ROW_HEIGHT * 0.32;
            const bottom = GRID_Y + rowIndex * ROW_HEIGHT + ROW_HEIGHT * 0.68;
            return (
              <line
                key={`tick-${hour}-${quarter}-${status}`}
                x1={x}
                y1={top}
                x2={x}
                y2={bottom}
                strokeWidth={0.4}
                opacity={0.5}
              />
            );
          });
        }),
      )}

      {HOUR_LABELS.map((label, hourIdx) => {
        const x = GRID_X + hourIdx * HOUR_WIDTH + HOUR_WIDTH / 2;
        return (
          <g key={`hour-${label}-${hourIdx.toString().padStart(2, "0")}`}>
            <text
              x={x}
              y={GRID_Y - 6}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={9}
              stroke="none"
            >
              {label}
            </text>
            <text
              x={x}
              y={GRID_Y + GRID_HEIGHT + 12}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={9}
              stroke="none"
            >
              {label}
            </text>
          </g>
        );
      })}

      {fragments.map((fragment, idx) => {
        const y = rowCenterY(fragment.event.status);
        const x1 = GRID_X + fragment.startX;
        const x2 = GRID_X + fragment.endX;
        const next = fragments[idx + 1];
        const verticalToNext =
          next !== undefined && Math.abs(next.startX - fragment.endX) < 0.001
            ? rowCenterY(next.event.status)
            : null;
        return (
          <g
            key={`frag-${fragment.event.id}-${fragment.startX}-${fragment.endX}`}
            data-slot="duty-fragment"
          >
            <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={2} strokeLinecap="butt" />
            {verticalToNext !== null && (
              <line x1={x2} y1={y} x2={x2} y2={verticalToNext} strokeWidth={2} />
            )}
          </g>
        );
      })}
    </g>
  );
}
