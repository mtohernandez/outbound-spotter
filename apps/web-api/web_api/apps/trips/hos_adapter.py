"""One-way bridge between the pure-Python HOS planner and the Django ORM.

Architecture invariant #1 (``context/architecture.md``): the HOS planner is
pure Python. This module imports ``web_api.hos`` to consume its public
surface (``plan_logs``, ``PlannerInputs``, ``DutyStatus``, ``LogEvent``,
``FuelStop``); ``web_api.hos.*`` does NOT import this module. The boundary
is one-way and asserted by ``apps/web-api/tests/hos/test_boundary.py``.

``materialize_plan(trip)`` is the only public callable. It:

1. Reconstructs ``DirectionsResult`` from the trip's persisted ``route_*``
   JSON columns (the cache layer in ``services.plan_trip`` already validated
   the shape; we trust it here).
2. Builds ``PlannerInputs`` with ``home_terminal_tz = America/New_York`` (the
   v1 hard-coded home-terminal TZ; a future driver-profile spec replaces).
3. Calls ``plan_logs(inputs)`` and re-derives the polyline-index list of
   ``FuelStop`` vertices via ``web_api.hos.fueling.fuel_stop_indices`` so the
   resulting ``TripStop`` rows carry the precise polyline vertex for the map.
4. ``bulk_create``s the ``TripStop`` / ``LogEvent`` / ``LogDay`` rows. The
   ``LogDay`` totals are denormalized at write time, with midnight-crossing
   events split per home-terminal-local date (architect-review m1).

Single-shot contract: a second ``materialize_plan(trip)`` on the same Trip
raises ``IntegrityError`` on the sequence unique constraints. Re-planning
lives in a future spec; in v1 the only entry path is ``services.plan_trip``
inside its ``transaction.atomic`` block, so a half-persisted Trip is
impossible.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from web_api.apps.trips.models import (
    DutyStatusChoices,
    LogDay,
    LogEvent,
    StopKind,
    Trip,
    TripStop,
)
from web_api.hos import (
    DutyStatus,
    FuelStop,
    LogEvent as HosLogEvent,
    PlannerInputs,
    plan_logs,
)
from web_api.hos.fueling import fuel_stop_indices
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
)

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence


HOME_TERMINAL_TZ: ZoneInfo = ZoneInfo("America/New_York")

_NOTE_PICKUP_PREFIX = "Pickup"
_NOTE_DROPOFF_PREFIX = "Dropoff"
_NOTE_FUELING = "Fueling"
_NOTE_BREAK_PREFIX = "30-min break"
_NOTE_OFF_DUTY_PREFIX = "10-hour off-duty"
_NOTE_RESTART_PREFIX = "34-hour restart"

# The planner's emitted ``note`` prefixes are unique enough that a single
# table covers every non-driving / non-sleeper-berth event kind. Order
# preserved for readability — the prefixes don't share a left-anchor.
_NOTE_TO_KIND: dict[str, StopKind] = {
    _NOTE_PICKUP_PREFIX: StopKind.PICKUP,
    _NOTE_DROPOFF_PREFIX: StopKind.DROPOFF,
    _NOTE_FUELING: StopKind.FUEL,
    _NOTE_RESTART_PREFIX: StopKind.RESTART,
    _NOTE_BREAK_PREFIX: StopKind.BREAK,
    _NOTE_OFF_DUTY_PREFIX: StopKind.SLEEPER,
}


def materialize_plan(trip: Trip) -> None:
    """Run the planner against ``trip`` and persist the result.

    Caller MUST hold an open ``transaction.atomic()`` block — every emitted
    row is bulk_inserted in this function, and any raise propagates so the
    caller's transaction can roll the Trip insert back too.
    """
    inputs = _build_planner_inputs(trip)
    events = plan_logs(inputs)
    polyline = inputs.directions.polyline
    fuel_stops = list(fuel_stop_indices(polyline, inputs.directions.segments))

    pickup_index = inputs.directions.segments[0].to_index
    dropoff_index = inputs.directions.segments[-1].to_index

    _emit_log_events(trip, events)
    _emit_trip_stops(
        trip,
        events,
        polyline=polyline,
        pickup_index=pickup_index,
        dropoff_index=dropoff_index,
        fuel_stops=fuel_stops,
    )
    _emit_log_days(
        trip,
        events,
        tz=HOME_TERMINAL_TZ,
        total_trip_miles=Decimal(str(inputs.directions.summary.distance_mi)),
    )


def _build_planner_inputs(trip: Trip) -> PlannerInputs:
    if trip.route_polyline is None or trip.route_segments is None or trip.route_summary is None:
        raise ValueError("Trip is missing route fields; cannot run planner.")

    directions = DirectionsResult(
        polyline=list(trip.route_polyline),
        summary=DirectionsSummary(**trip.route_summary),
        segments=[DirectionsSegment(**seg) for seg in trip.route_segments],
    )
    return PlannerInputs(
        directions=directions,
        cycle_hours_used=trip.cycle_hours_used,
        start_at=trip.start_at,
        home_terminal_tz=HOME_TERMINAL_TZ,
    )


def _duty_status_to_choices(status: DutyStatus) -> str:
    """Translate the planner enum to the Django column choice via ``.value``.

    The ``DutyStatusChoices.values`` set is asserted equal to
    ``DutyStatus.__members__`` in ``tests/hos/test_boundary.py``; this
    function exists so a planner-side enum addition surfaces here at type
    check time rather than at row-insert time.
    """
    return DutyStatusChoices(status.value).value


def _emit_log_events(trip: Trip, events: Sequence[HosLogEvent]) -> None:
    rows = [
        LogEvent(
            trip=trip,
            sequence=index,
            status=_duty_status_to_choices(event.status),
            start=event.start,
            duration_s=int(event.duration.total_seconds()),
            location=event.location,
            note=event.note,
        )
        for index, event in enumerate(events)
    ]
    LogEvent.objects.bulk_create(rows)


def _emit_trip_stops(
    trip: Trip,
    events: Sequence[HosLogEvent],
    *,
    polyline: Sequence[Sequence[float]],
    pickup_index: int,
    dropoff_index: int,
    fuel_stops: Sequence[FuelStop],
) -> None:
    """Project the planner events into observable stops.

    DRIVING events are not stops. Every non-driving event corresponds to one
    ``TripStop``; the contract that ``scheduled_at == originating LogEvent.start``
    (architect-review m7) is what spec 07's map and spec 08's logs both
    depend on.
    """
    fuel_iter = iter(fuel_stops)
    rows: list[TripStop] = []
    sequence = 0
    for event in events:
        kind = _stop_kind_from_event(event)
        if kind is None:
            continue

        lat, lon, polyline_index = _stop_location(
            event,
            kind,
            polyline=polyline,
            pickup_index=pickup_index,
            dropoff_index=dropoff_index,
            fuel_iter=fuel_iter,
        )

        rows.append(
            TripStop(
                trip=trip,
                kind=kind.value,
                sequence=sequence,
                polyline_index=polyline_index,
                lat=Decimal(format(lat, ".6f")),
                lon=Decimal(format(lon, ".6f")),
                label="",
                scheduled_at=event.start,
                duration_s=int(event.duration.total_seconds()),
            )
        )
        sequence += 1

    TripStop.objects.bulk_create(rows)


def _stop_kind_from_event(event: HosLogEvent) -> StopKind | None:
    """Map a planner event to its observable stop kind, or ``None`` for driving.

    SLEEPER_BERTH always maps to SLEEPER. Every other non-driving event is
    classified by note prefix via ``_NOTE_TO_KIND``; the planner's note
    strings are stable per ``web_api.hos.planner._make_constraint_event`` and
    ``_emit_static_leg``.
    """
    if event.status == DutyStatus.DRIVING:
        return None
    if event.status == DutyStatus.SLEEPER_BERTH:
        return StopKind.SLEEPER
    for prefix, kind in _NOTE_TO_KIND.items():
        if event.note.startswith(prefix):
            return kind
    return None


def _stop_location(
    event: HosLogEvent,
    kind: StopKind,
    *,
    polyline: Sequence[Sequence[float]],
    pickup_index: int,
    dropoff_index: int,
    fuel_iter: Iterator[FuelStop],
) -> tuple[float, float, int]:
    """Return ``(lat, lon, polyline_index)`` for a stop's marker position.

    Pickup / dropoff snap to the segment way-point indices the ORS response
    already gave us. Fuel stops snap to the next pre-computed ``FuelStop``
    vertex (consumed in order — the planner emits them sequentially). Break
    / sleeper / restart fall back to the nearest polyline vertex to the
    event's recorded lat/lon, which the planner derives from a mid-segment
    interpolation. ``label`` stays empty in v1 (reverse-geocoding deferred).
    """
    lat, lon = _parse_location(event.location)
    if kind == StopKind.PICKUP:
        polyline_index = pickup_index
    elif kind == StopKind.DROPOFF:
        polyline_index = dropoff_index
    elif kind == StopKind.FUEL:
        fuel_stop = next(fuel_iter, None)
        if fuel_stop is None:
            polyline_index = _nearest_polyline_index(polyline, lat, lon)
        else:
            polyline_index = fuel_stop.polyline_index
            lat, lon = fuel_stop.lat, fuel_stop.lon
    else:
        polyline_index = _nearest_polyline_index(polyline, lat, lon)
    return lat, lon, polyline_index


def _parse_location(location: str) -> tuple[float, float]:
    """Parse the ``"lat, lon"`` form the planner emits via ``_coord``."""
    lat_part, lon_part = location.split(",", 1)
    return float(lat_part.strip()), float(lon_part.strip())


def _nearest_polyline_index(polyline: Sequence[Sequence[float]], lat: float, lon: float) -> int:
    """Linear scan for the nearest ``[lon, lat]`` vertex in ``polyline``.

    Squared Euclidean distance on raw lat/lon is fine for this use — the
    polyline is short for v1 trips (~hundreds of vertices) and we only need
    a rough vertex anchor for the FE marker. Replace with great-circle math
    if the FE ever needs sub-vertex precision.
    """
    best_index = 0
    best_dist = float("inf")
    for i, vertex in enumerate(polyline):
        dlon = vertex[0] - lon
        dlat = vertex[1] - lat
        dist = dlon * dlon + dlat * dlat
        if dist < best_dist:
            best_dist = dist
            best_index = i
    return best_index


def _emit_log_days(
    trip: Trip,
    events: Sequence[HosLogEvent],
    *,
    tz: ZoneInfo,
    total_trip_miles: Decimal,
) -> None:
    """Bucket events into per-home-terminal-local-date rollups.

    A single LogEvent that crosses home-terminal midnight is persisted as one
    row (invariant #2: one duty-status change → one row), but its seconds are
    attributed to each calendar date proportionally. Driving miles are split
    by the time fraction in each date so transcontinental trips show the
    correct daily totals on the §395.8 grid; the daily ``total_miles`` sums
    to ``total_trip_miles`` (the ORS summary) up to a 0.1-mile rounding
    delta.
    """
    total_driving_s = sum(
        int(e.duration.total_seconds()) for e in events if e.status == DutyStatus.DRIVING
    )
    miles_per_second = (
        total_trip_miles / Decimal(total_driving_s) if total_driving_s > 0 else Decimal("0")
    )

    aggregates: dict[date, dict[str, Decimal]] = {}
    for event in events:
        fragments = _split_event_across_dates(event, tz)
        for local_date, seconds in fragments:
            bucket = aggregates.setdefault(local_date, _empty_aggregate())
            _accumulate(bucket, event, seconds, miles_per_second)

    rows = [
        LogDay(
            trip=trip,
            date=local_date,
            off_duty_s=int(bucket["off_duty_s"]),
            sleeper_s=int(bucket["sleeper_s"]),
            driving_s=int(bucket["driving_s"]),
            on_duty_not_driving_s=int(bucket["on_duty_not_driving_s"]),
            total_miles=bucket["total_miles"].quantize(Decimal("0.1")),
        )
        for local_date, bucket in sorted(aggregates.items())
    ]
    LogDay.objects.bulk_create(rows)


def _empty_aggregate() -> dict[str, Decimal]:
    return {
        "off_duty_s": Decimal("0"),
        "sleeper_s": Decimal("0"),
        "driving_s": Decimal("0"),
        "on_duty_not_driving_s": Decimal("0"),
        "total_miles": Decimal("0"),
    }


def _split_event_across_dates(
    event: HosLogEvent,
    tz: ZoneInfo,
) -> list[tuple[date, int]]:
    """Return ``[(local_date, seconds_in_that_date)]`` covering the event.

    Walks home-terminal-local midnight boundaries between ``event.start`` and
    ``event.start + event.duration``. DST transitions naturally fall out
    because ``datetime`` arithmetic respects them when the tz is attached.
    """
    start_local = event.start.astimezone(tz)
    end_local = (event.start + event.duration).astimezone(tz)

    if start_local.date() == end_local.date():
        return [(start_local.date(), int(event.duration.total_seconds()))]

    fragments: list[tuple[date, int]] = []
    cursor = start_local
    final = end_local
    while cursor < final:
        next_midnight_local = datetime.combine(
            cursor.date() + timedelta(days=1),
            time.min,
            tzinfo=tz,
        )
        fragment_end = min(next_midnight_local, final)
        seconds = int((fragment_end - cursor).total_seconds())
        if seconds > 0:
            fragments.append((cursor.date(), seconds))
        cursor = fragment_end
    return fragments


def _accumulate(
    bucket: dict[str, Decimal],
    event: HosLogEvent,
    seconds: int,
    miles_per_second: Decimal,
) -> None:
    """Add ``seconds`` of ``event`` to the per-day bucket; allocate miles.

    Miles are derived from the trip's ORS-reported total distance divided by
    its total driving seconds — the implicit effective speed for THIS trip.
    The per-day total therefore sums to the ORS summary (up to rounding) for
    the driver-visible §395.8 grid header. Non-driving events contribute
    zero miles.
    """
    increment = Decimal(seconds)
    if event.status == DutyStatus.DRIVING:
        bucket["driving_s"] += increment
        bucket["total_miles"] += increment * miles_per_second
    elif event.status == DutyStatus.SLEEPER_BERTH:
        bucket["sleeper_s"] += increment
    elif event.status == DutyStatus.ON_DUTY_NOT_DRIVING:
        bucket["on_duty_not_driving_s"] += increment
    else:
        bucket["off_duty_s"] += increment
