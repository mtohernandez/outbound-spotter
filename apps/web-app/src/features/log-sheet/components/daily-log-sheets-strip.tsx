import { useUser } from "@clerk/react";
import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { useMemo, useState } from "react";

import { DailyLogSheet } from "@/features/log-sheet/components/daily-log-sheet";
import { createEmptyMetadata, type SheetMetadata } from "@/features/log-sheet/types/sheet-metadata";
import type { TripLabels } from "@/features/log-sheet/utils/lookup-event-location";
import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";

interface DailyLogSheetsStripProps {
  readonly trip: TripResponse;
  readonly plan: TripPlan;
}

// Structural shape — the Clerk `UserResource` exposes these three fields. We
// keep the type structural (Pick-shaped) so the test mock's narrower shape
// (no `fullName`) still satisfies the call without pulling the Clerk SDK
// type surface into a renderer that only needs three nullable strings.
interface DriverNameSource {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

function deriveDriverLegalName(user: DriverNameSource | null | undefined): string {
  if (user == null) return "—";
  const direct = user.fullName?.trim();
  if (direct !== undefined && direct !== "") return direct;
  const composed = [user.firstName, user.lastName]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ")
    .trim();
  return composed !== "" ? composed : "—";
}

function formatStripDateHeader(dateIso: string, timeZone: string): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}

// Composition root for the Log Sheets tab. One sheet per LogDay (ascending
// by date). Per spec 08 decision 12, the SheetMetadata is lifted to the
// strip — every sheet on the trip reads the same truck / carrier / cert /
// shipping values (the FMCSA paper-log convention: same trip, same data).
//
// Persistence (driver profile + per-trip overrides + reverse-geocoded remarks)
// lands in spec 10; values reset on full route unmount in v1.
export function DailyLogSheetsStrip({ trip, plan }: DailyLogSheetsStripProps): React.ReactElement {
  const { user } = useUser();
  const driverLegalName = deriveDriverLegalName(user);
  const [metadata, setMetadata] = useState<SheetMetadata>(() => createEmptyMetadata());

  const tripLabels = useMemo<TripLabels>(
    () => ({
      current_label: trip.current_label,
      pickup_label: trip.pickup_label,
      dropoff_label: trip.dropoff_label,
    }),
    [trip.current_label, trip.pickup_label, trip.dropoff_label],
  );

  const sortedDays = useMemo(
    () => [...plan.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [plan.days],
  );

  return (
    <TooltipProvider>
      <div
        data-slot="daily-log-sheets-strip"
        className="bg-muted/30 flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4"
      >
        {sortedDays.length === 0 ? (
          <p className="text-muted-foreground text-sm">No log days were planned for this trip.</p>
        ) : (
          sortedDays.map((day, index) => (
            <section key={day.id} aria-label={`Log sheet for ${day.date}`}>
              <h3 className="font-display text-foreground mb-2 text-sm font-semibold tracking-wide">
                {formatStripDateHeader(day.date, plan.home_terminal_tz)}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  Day {index + 1} of {sortedDays.length}
                </span>
              </h3>
              <DailyLogSheet
                day={day}
                events={plan.events}
                stops={plan.stops}
                trip={tripLabels}
                homeTerminalTz={plan.home_terminal_tz}
                driverLegalName={driverLegalName}
                metadata={metadata}
                onMetadataChange={setMetadata}
                sheetId={`sheet-${day.id}`}
              />
            </section>
          ))
        )}
      </div>
    </TooltipProvider>
  );
}

export default DailyLogSheetsStrip;
