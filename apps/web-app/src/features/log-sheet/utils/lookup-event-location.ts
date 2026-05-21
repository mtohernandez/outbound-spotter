import type { LogEvent, TripStop } from "@/features/trip-planner/schemas/trip-plan";
import { formatLatLon } from "@/features/trip-planner/utils/format-lat-lon";

export interface TripLabels {
  readonly current_label: string;
  readonly pickup_label: string;
  readonly dropoff_label: string;
}

export interface LookupInputs {
  readonly event: LogEvent;
  readonly trip: TripLabels;
  readonly stops: readonly TripStop[];
  // Sequence of the very first `driving` event across the trip — its location
  // is the trip's current/departure label, which only the trip object knows.
  readonly firstDrivingEventSequence: number | null;
}

const STOP_PROXIMITY_MS = 5 * 60 * 1000;

// Three-tier precedence for the Remarks column at each duty-status change.
// Spec 08 decision 10. Spec 10 fills `TripStop.label` via reverse-geocode;
// this lookup picks it up transparently with no renderer change required.
export function lookupEventLocation(inputs: LookupInputs): string {
  const { event, trip, stops, firstDrivingEventSequence } = inputs;
  const note = event.note;
  const noteLower = note.toLowerCase();

  // Tier 1 — trip-level address labels stamped by Pelias at trip-create time.
  if (noteLower.startsWith("pickup") && trip.pickup_label !== "") return trip.pickup_label;
  if (noteLower.startsWith("dropoff") && trip.dropoff_label !== "") return trip.dropoff_label;
  if (
    firstDrivingEventSequence !== null &&
    event.sequence === firstDrivingEventSequence &&
    event.status === "driving" &&
    trip.current_label !== ""
  ) {
    return trip.current_label;
  }

  // Tier 2 — TripStop.label by scheduled-time proximity (within 5 minutes of
  // the event start). v1 sees these empty; spec 10 fills them.
  const eventStartMs = new Date(event.start).valueOf();
  if (!Number.isNaN(eventStartMs)) {
    const labeledStop = stops.find((stop) => {
      const stopMs = new Date(stop.scheduled_at).valueOf();
      return (
        !Number.isNaN(stopMs) &&
        Math.abs(stopMs - eventStartMs) <= STOP_PROXIMITY_MS &&
        stop.label !== ""
      );
    });
    if (labeledStop !== undefined) return labeledStop.label;
  }

  // Tier 3 — planner-supplied `LogEvent.location` (the city/state string the
  // adapter stamps on each row).
  if (event.location !== "") return event.location;

  // Tier 4 — lat/lon fallback from a proximate stop (label was empty above).
  if (!Number.isNaN(eventStartMs)) {
    const proximateStop = stops.find((stop) => {
      const stopMs = new Date(stop.scheduled_at).valueOf();
      return !Number.isNaN(stopMs) && Math.abs(stopMs - eventStartMs) <= STOP_PROXIMITY_MS;
    });
    if (proximateStop !== undefined) return formatLatLon(proximateStop.lat, proximateStop.lon);
  }

  // Last resort — surface the note (driver still sees the §395.8-required
  // reason text) or em-dash so the column never goes blank.
  return note !== "" ? note : "—";
}

// Helper for the strip — find the sequence of the first `driving` event in a
// trip's events list. Lives here so the renderer doesn't duplicate the scan.
export function firstDrivingSequence(events: readonly LogEvent[]): number | null {
  for (const event of events) {
    if (event.status === "driving") return event.sequence;
  }
  return null;
}
