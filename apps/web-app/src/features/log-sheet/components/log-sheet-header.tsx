import { EditableLine } from "@/features/log-sheet/components/editable-line";
import type { SheetMetadata } from "@/features/log-sheet/types/sheet-metadata";
import { formatTzLabel } from "@/features/log-sheet/utils/format-tz-label";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface LogSheetHeaderProps {
  readonly day: LogDay;
  readonly homeTerminalTz: string;
  readonly driverLegalName: string;
  readonly metadata: SheetMetadata;
  readonly onMetadataChange: (next: SheetMetadata) => void;
  // Stable per-sheet so the editable line IDs don't collide across the strip.
  readonly idPrefix: string;
}

function formatHeaderDate(dateIso: string, timeZone: string): string {
  // dateIso is YYYY-MM-DD (no time component). Anchor at noon UTC so the tz
  // shift can never push us into the prior calendar day.
  const date = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}

// HTML header block on each §395.8 sheet. Hosts the editable Vehicle / Carrier
// / Address / Co-driver fields plus the read-only Date / Total Miles / Driver
// callouts. Sits ABOVE the inline SVG grid.
export function LogSheetHeader({
  day,
  homeTerminalTz,
  driverLegalName,
  metadata,
  onMetadataChange,
  idPrefix,
}: LogSheetHeaderProps): React.ReactElement {
  return (
    <header className="border-foreground/30 text-foreground border-b px-4 pt-4 pb-3">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-display text-muted-foreground text-xs tracking-[0.18em] uppercase">
            Driver&rsquo;s Daily Log
          </p>
          <p className="font-display text-base leading-tight font-semibold">
            (One calendar day, 24 hours)
          </p>
        </div>
        <div className="text-muted-foreground max-w-[14rem] text-right text-[10px] leading-tight">
          <p className="tracking-wider uppercase">Original — Submit to carrier within 13 days</p>
          <p className="tracking-wider uppercase">Duplicate — Driver retains for eight days</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-[10px] tracking-wider uppercase">Date</dt>
          <dd className="font-mono text-sm">{formatHeaderDate(day.date, homeTerminalTz)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Total miles driving today
          </dt>
          <dd className="font-mono text-sm">{day.total_miles.toFixed(1)} mi</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Time standard
          </dt>
          <dd className="font-mono text-sm">{formatTzLabel(homeTerminalTz)}</dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
            Vehicle Numbers (SHOW EACH UNIT)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <EditableLine
              id={`${idPrefix}-truck`}
              label="Truck or Tractor number"
              value={metadata.truckNumber}
              placeholder="Truck / Tractor #"
              onChange={(next) => {
                onMetadataChange({ ...metadata, truckNumber: next });
              }}
            />
            <EditableLine
              id={`${idPrefix}-trailer`}
              label="Trailer number"
              value={metadata.trailerNumber}
              placeholder="Trailer #"
              onChange={(next) => {
                onMetadataChange({ ...metadata, trailerNumber: next });
              }}
            />
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
            Name of Carrier(s)
          </p>
          <EditableLine
            id={`${idPrefix}-carrier`}
            label="Name of carrier(s)"
            value={metadata.carrierName}
            placeholder="Motor carrier name"
            onChange={(next) => {
              onMetadataChange({ ...metadata, carrierName: next });
            }}
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
            Main Office Address
          </p>
          <EditableLine
            id={`${idPrefix}-address`}
            label="Main office address"
            value={metadata.mainOfficeAddress}
            placeholder="City, State"
            onChange={(next) => {
              onMetadataChange({ ...metadata, mainOfficeAddress: next });
            }}
          />
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
            Co-driver
          </p>
          <EditableLine
            id={`${idPrefix}-co-driver`}
            label="Name of co-driver"
            value={metadata.coDriverName}
            placeholder="(none)"
            onChange={(next) => {
              onMetadataChange({ ...metadata, coDriverName: next });
            }}
          />
        </div>
      </div>

      <div className="text-muted-foreground mt-3 text-[10px] tracking-wider uppercase">Driver</div>
      <p className="font-display text-sm">{driverLegalName}</p>
    </header>
  );
}
