import { DUTY_ROW_INDEX } from "@/features/log-sheet/components/duty-row-map";
import {
  GRID_HEIGHT,
  GRID_Y,
  ROW_HEIGHT,
  TOTALS_WIDTH,
  TOTALS_X,
} from "@/features/log-sheet/components/grid-geometry";
import { formatSeconds } from "@/features/log-sheet/utils/format-seconds";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface TotalsColumnProps {
  readonly day: LogDay;
}

// Right-of-grid "Total Hours" column required by §395.8(a)(8). Four per-status
// cells then a bottom cell that must read 24h 0m — invariant #2 + the adapter's
// midnight-split rollup guarantee the sum. Embedded inside the parent `<svg>`.
export function TotalsColumn({ day }: TotalsColumnProps): React.ReactElement {
  const totalSeconds = day.off_duty_s + day.sleeper_s + day.driving_s + day.on_duty_not_driving_s;

  const rows: { key: string; seconds: number; index: 0 | 1 | 2 | 3 }[] = [
    { key: "off-duty", seconds: day.off_duty_s, index: DUTY_ROW_INDEX.off_duty },
    { key: "sleeper-berth", seconds: day.sleeper_s, index: DUTY_ROW_INDEX.sleeper_berth },
    { key: "driving", seconds: day.driving_s, index: DUTY_ROW_INDEX.driving },
    {
      key: "on-duty-not-driving",
      seconds: day.on_duty_not_driving_s,
      index: DUTY_ROW_INDEX.on_duty_not_driving,
    },
  ];

  return (
    <g data-slot="totals-column" stroke="currentColor" fill="currentColor">
      <rect
        x={TOTALS_X}
        y={GRID_Y}
        width={TOTALS_WIDTH}
        height={GRID_HEIGHT + ROW_HEIGHT}
        fill="none"
        strokeWidth={1.2}
      />
      <text
        x={TOTALS_X + TOTALS_WIDTH / 2}
        y={GRID_Y - 6}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={9}
        stroke="none"
      >
        Total Hours
      </text>
      {rows.map(({ key, seconds, index }) => {
        const rowY = GRID_Y + index * ROW_HEIGHT;
        return (
          <g key={`total-${key}`}>
            <line
              x1={TOTALS_X}
              y1={rowY + ROW_HEIGHT}
              x2={TOTALS_X + TOTALS_WIDTH}
              y2={rowY + ROW_HEIGHT}
              strokeWidth={0.6}
            />
            <text
              x={TOTALS_X + TOTALS_WIDTH / 2}
              y={rowY + ROW_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-mono)"
              fontSize={11}
              stroke="none"
              data-slot={`total-${key}`}
            >
              {formatSeconds(seconds)}
            </text>
          </g>
        );
      })}
      <text
        x={TOTALS_X + TOTALS_WIDTH / 2}
        y={GRID_Y + GRID_HEIGHT + ROW_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-mono)"
        fontSize={12}
        fontWeight={600}
        stroke="none"
        data-slot="total-day"
      >
        = {formatSeconds(totalSeconds)}
      </text>
    </g>
  );
}
