import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@outbound/ui/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import type { LogDay, LogEvent, TripPlan } from "@/features/trip-planner/schemas/trip-plan";

const SECONDS_PER_HOUR = 3600;

function formatHours(seconds: number): string {
  return (seconds / SECONDS_PER_HOUR).toFixed(1);
}

function formatDate(dateIso: string, tz: string): string {
  const [year, month, day] = dateIso.split("-").map((part) => Number.parseInt(part, 10));
  if (year === undefined || month === undefined || day === undefined) return dateIso;
  // Build a noon-UTC date so the wall-clock date stays the same in any TZ.
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: tz,
  }).format(date);
}

function formatEventTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));
}

interface Props {
  readonly plan: TripPlan;
}

export function DayBreakdownAccordion({ plan }: Props): React.ReactElement {
  const tz = plan.home_terminal_tz;

  // Single pass: bucket each event by its wall-clock YYYY-MM-DD in the
  // home-terminal TZ. One Intl.DateTimeFormat per render (vs N × M before).
  const eventsByDate = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const buckets = new Map<string, LogEvent[]>();
    for (const event of plan.events) {
      const key = fmt.format(new Date(event.start));
      const list = buckets.get(key);
      if (list === undefined) {
        buckets.set(key, [event]);
      } else {
        list.push(event);
      }
    }
    return buckets;
  }, [plan.events, tz]);

  return (
    <div className="flex flex-col gap-1.5">
      {plan.days.map((day, index) => (
        <DayItem
          key={day.id}
          day={day}
          tz={tz}
          events={eventsByDate.get(day.date) ?? []}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}

interface DayItemProps {
  readonly day: LogDay;
  readonly tz: string;
  readonly events: readonly LogEvent[];
  readonly defaultOpen: boolean;
}

function DayItem({ day, tz, events, defaultOpen }: DayItemProps): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  const onDutyHours = day.driving_s + day.on_duty_not_driving_s;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border overflow-hidden rounded-md border"
    >
      <CollapsibleTrigger className="hover:bg-accent/60 focus-visible:ring-ring flex w-full items-center justify-between gap-3 px-3 py-2 text-left outline-none focus-visible:ring-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{formatDate(day.date, tz)}</span>
          <span className="text-muted-foreground font-mono text-xs">
            {day.total_miles.toFixed(0)} mi · {formatHours(day.driving_s)}h drive ·{" "}
            {formatHours(onDutyHours)}h on-duty · {events.length} events
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 data-[state=open]:rotate-180 motion-safe:transition-transform"
          data-state={open ? "open" : "closed"}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground p-3 text-xs">No events for this day.</p>
        ) : (
          <ol className="border-border divide-border flex flex-col divide-y border-t">
            {events.map((event, idx) => (
              <li
                key={`${event.start}-${idx.toString()}`}
                className="flex items-baseline gap-3 px-3 py-1.5 text-xs"
              >
                <span className="text-muted-foreground shrink-0 font-mono">
                  {formatEventTime(event.start, tz)}
                </span>
                <span className="shrink-0 font-medium capitalize">
                  {event.status.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground truncate">
                  {event.location || event.note || ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
