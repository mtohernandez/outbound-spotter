import { DutyStatusGrid } from "@/features/log-sheet/components/duty-status-grid";
import {
  GRID_HEIGHT,
  GRID_X,
  GRID_Y,
  GRID_WIDTH,
  REMARKS_HEIGHT,
  REMARKS_Y,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "@/features/log-sheet/components/grid-geometry";
import { LogSheetFooter } from "@/features/log-sheet/components/log-sheet-footer";
import { LogSheetHeader } from "@/features/log-sheet/components/log-sheet-header";
import { RemarksColumn } from "@/features/log-sheet/components/remarks-column";
import { TotalsColumn } from "@/features/log-sheet/components/totals-column";
import type { SheetMetadata } from "@/features/log-sheet/types/sheet-metadata";
import { eventsByDay } from "@/features/log-sheet/utils/events-by-day";
import { formatSeconds } from "@/features/log-sheet/utils/format-seconds";
import type { TripLabels } from "@/features/log-sheet/utils/lookup-event-location";
import type { LogDay, LogEvent, TripStop } from "@/features/trip-planner/schemas/trip-plan";

interface DailyLogSheetProps {
  readonly day: LogDay;
  readonly events: readonly LogEvent[];
  readonly stops: readonly TripStop[];
  readonly trip: TripLabels;
  readonly homeTerminalTz: string;
  readonly driverLegalName: string;
  readonly metadata: SheetMetadata;
  readonly onMetadataChange: (next: SheetMetadata) => void;
  readonly sheetId: string;
}

const SIGNATURE_X = SHEET_WIDTH - 220;
const SIGNATURE_LINE_Y = REMARKS_Y + REMARKS_HEIGHT + 60;
const SIGNATURE_TEXT_Y = SIGNATURE_LINE_Y - 6;

function formatTitleDate(dateIso: string, timeZone: string): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}

// One §395.8 Daily Log Sheet per LogDay. HTML chrome wraps an inline SVG that
// owns the 24-hour grid, totals column, remarks column, and (when certified)
// the signature `<text>`. The SVG is PDF-friendly per spec 09 — every glyph
// is a primitive (`<line>`, `<text>`, `<rect>`, `<path>`), no `<foreignObject>`.
export function DailyLogSheet({
  day,
  events,
  stops,
  trip,
  homeTerminalTz,
  driverLegalName,
  metadata,
  onMetadataChange,
  sheetId,
}: DailyLogSheetProps): React.ReactElement {
  const fragments = eventsByDay(events, day.date, homeTerminalTz);
  const titleId = `${sheetId}-title`;
  const descId = `${sheetId}-desc`;
  const signatureName =
    metadata.signatureOverride.trim() === "" ? driverLegalName : metadata.signatureOverride;

  const summary = [
    `Off Duty ${formatSeconds(day.off_duty_s)}`,
    `Sleeper Berth ${formatSeconds(day.sleeper_s)}`,
    `Driving ${formatSeconds(day.driving_s)}`,
    `On Duty Not Driving ${formatSeconds(day.on_duty_not_driving_s)}`,
    `Total ${formatSeconds(
      day.off_duty_s + day.sleeper_s + day.driving_s + day.on_duty_not_driving_s,
    )}`,
  ].join(" · ");

  return (
    <article
      data-slot="daily-log-sheet"
      data-sheet-id={sheetId}
      aria-labelledby={titleId}
      className="border-foreground/30 bg-card text-card-foreground overflow-hidden rounded-lg border shadow-sm"
    >
      <LogSheetHeader
        day={day}
        homeTerminalTz={homeTerminalTz}
        driverLegalName={driverLegalName}
        metadata={metadata}
        onMetadataChange={onMetadataChange}
        idPrefix={sheetId}
      />

      <div className="overflow-x-auto px-4 py-3">
        <svg
          role="img"
          viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`}
          aria-labelledby={titleId}
          aria-describedby={descId}
          preserveAspectRatio="xMidYMin meet"
          className="text-foreground h-auto w-full"
          style={{ minWidth: 720 }}
        >
          <title id={titleId}>{`Daily Log — ${formatTitleDate(day.date, homeTerminalTz)}`}</title>
          <desc id={descId}>{summary}</desc>

          <DutyStatusGrid fragments={fragments} />
          <TotalsColumn day={day} />
          <RemarksColumn fragments={fragments} events={events} stops={stops} trip={trip} />

          {/* Signature line + (when certified) the typed-name `<text>`. */}
          <line
            x1={SIGNATURE_X}
            y1={SIGNATURE_LINE_Y}
            x2={SIGNATURE_X + 180}
            y2={SIGNATURE_LINE_Y}
            stroke="currentColor"
            strokeWidth={0.6}
          />
          <text
            x={SIGNATURE_X}
            y={SIGNATURE_LINE_Y + 14}
            fontFamily="var(--font-sans)"
            fontSize={9}
            fill="currentColor"
            stroke="none"
            opacity={0.75}
          >
            Driver&rsquo;s signature (§395.8(a)(7))
          </text>
          {metadata.iCertify && signatureName.trim() !== "" ? (
            <text
              data-slot="sheet-signature"
              x={SIGNATURE_X + 6}
              y={SIGNATURE_TEXT_Y}
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontSize={16}
              fill="currentColor"
              stroke="none"
            >
              {signatureName}
            </text>
          ) : null}

          {/* Grid frame so the box reads as one continuous region even when
              the duty-status timeline is empty (e.g. all-off-duty day). */}
          <rect
            x={GRID_X}
            y={GRID_Y}
            width={GRID_WIDTH}
            height={GRID_HEIGHT}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            data-slot="grid-frame"
          />
        </svg>
      </div>

      <LogSheetFooter
        idPrefix={sheetId}
        driverLegalName={driverLegalName}
        metadata={metadata}
        onMetadataChange={onMetadataChange}
      />
    </article>
  );
}
