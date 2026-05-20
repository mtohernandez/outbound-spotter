"""HOS planner entry point. Composes state + rules + fueling into a deterministic event list.

The driving-leg loop slices each ORS segment around the soonest §395 constraint
(cycle cap, 14h window, 11h drive limit, 8h break, 1000-mi fuel stop) so a
2000-mile single-segment trip emits the correct sequence of drive / break /
fuel / off-duty events. This is a deliberate deviation from the spec's
single-event-per-leg pseudocode — long-haul trips require slicing, and the
goldens explicitly assert sliced output (assessment_break_only is exactly
8h DRIVING → 30-min break → 1h DRIVING, not one 9h DRIVING preceded by a
break).

Two surfaces encode each §395 limit:

1. ``rules.py::apply_*`` — predicate functions that ``test_rules.py`` exercises
   and that ``_emit_static_leg`` calls for the cycle-cap check on non-driving
   legs. These remain the spec-mandated public surface and the single source
   of truth for the regulation interpretation.
2. ``planner.py::_max_drive_chunk`` + ``_make_constraint_event`` — the slicing
   loop that re-derives the same thresholds from the shared constants in
   ``rules.py`` (DRIVE_LIMIT_PER_WINDOW, DRIVE_WINDOW_LIMIT, …). The slicer
   imports the constants but not the predicates, because predicates answer
   "should I emit?" while the slicer answers "how long until I must emit?".

Both surfaces use the same constants; a change to a threshold must update
``rules.py`` constants only, and both layers track in lockstep. The end-to-end
goldens guard against drift between the two.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Final, Literal

from web_api.hos.rules import (
    CYCLE_LIMIT_HOURS,
    DRIVE_LIMIT_PER_BREAK,
    DRIVE_LIMIT_PER_WINDOW,
    DRIVE_WINDOW_LIMIT,
    FUEL_STOP_DURATION,
    RESTART_DURATION,
    TEN_HOUR_OFF,
    THIRTY_MIN_BREAK,
    apply_cycle_cap,
)
from web_api.hos.state import PlannerState, advance
from web_api.hos.types import DutyStatus, LogEvent

if TYPE_CHECKING:
    from web_api.hos.types import PlannerInputs


_PICKUP_DURATION_S: Final[int] = 3600
_DROPOFF_DURATION_S: Final[int] = 3600
_ZERO_DISTANCE_THRESHOLD_MI: Final[float] = 0.01
_SECONDS_PER_MINUTE: Final[int] = 60
_SECONDS_PER_HOUR: Final[int] = 3600
_SEGMENTS_FOR_TWO_LEGS: Final[int] = 2


@dataclass(frozen=True, slots=True)
class PlannedLeg:
    """One leg the planner walks: a driving segment OR a 1h pickup/dropoff stop."""

    kind: Literal["driving", "pickup", "dropoff"]
    duration_s: int
    distance_mi: float
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    polyline_index_end: int


def plan_logs(inputs: PlannerInputs) -> list[LogEvent]:
    """Compute the §395-compliant ``LogEvent`` sequence for ``inputs``.

    Deterministic: same inputs → same output. No wall-clock reads, no RNG.
    """
    events: list[LogEvent] = []
    state = PlannerState.initial(inputs)
    for leg in _build_legs(inputs):
        if leg.kind == "driving":
            state = _drive_leg(state, leg, events)
        else:
            state = _emit_static_leg(state, leg, events)
    return events


def _round_to_minute(seconds: int) -> int:
    return ((seconds + _SECONDS_PER_MINUTE // 2) // _SECONDS_PER_MINUTE) * _SECONDS_PER_MINUTE


def _coord(lat: float, lon: float) -> str:
    return f"{lat:.4f}, {lon:.4f}"


def _build_legs(inputs: PlannerInputs) -> list[PlannedLeg]:
    """Translate ORS segments into the four-leg shape (drive→pickup→drive→dropoff).

    Zero-distance segments (< 0.01 mi, ~52 ft) are skipped per decision 7:
    the FE doesn't enforce distinct addresses, and Pelias rounding can yield
    identical coords for the same address typed two ways.
    """
    polyline = inputs.directions.polyline
    segments = inputs.directions.segments
    if not segments:
        raise ValueError("directions.segments must contain at least one entry")

    current_lon, current_lat = polyline[0][0], polyline[0][1]
    pickup_idx = segments[0].to_index
    pickup_lon, pickup_lat = polyline[pickup_idx][0], polyline[pickup_idx][1]
    dropoff_idx = (
        segments[1].to_index if len(segments) >= _SEGMENTS_FOR_TWO_LEGS else len(polyline) - 1
    )
    dropoff_lon, dropoff_lat = polyline[dropoff_idx][0], polyline[dropoff_idx][1]

    legs: list[PlannedLeg] = []

    if segments[0].distance_mi >= _ZERO_DISTANCE_THRESHOLD_MI:
        legs.append(
            PlannedLeg(
                kind="driving",
                duration_s=_round_to_minute(segments[0].duration_s),
                distance_mi=segments[0].distance_mi,
                start_lat=current_lat,
                start_lon=current_lon,
                end_lat=pickup_lat,
                end_lon=pickup_lon,
                polyline_index_end=pickup_idx,
            )
        )

    legs.append(
        PlannedLeg(
            kind="pickup",
            duration_s=_PICKUP_DURATION_S,
            distance_mi=0.0,
            start_lat=pickup_lat,
            start_lon=pickup_lon,
            end_lat=pickup_lat,
            end_lon=pickup_lon,
            polyline_index_end=pickup_idx,
        )
    )

    if (
        len(segments) >= _SEGMENTS_FOR_TWO_LEGS
        and segments[1].distance_mi >= _ZERO_DISTANCE_THRESHOLD_MI
    ):
        legs.append(
            PlannedLeg(
                kind="driving",
                duration_s=_round_to_minute(segments[1].duration_s),
                distance_mi=segments[1].distance_mi,
                start_lat=pickup_lat,
                start_lon=pickup_lon,
                end_lat=dropoff_lat,
                end_lon=dropoff_lon,
                polyline_index_end=dropoff_idx,
            )
        )

    legs.append(
        PlannedLeg(
            kind="dropoff",
            duration_s=_DROPOFF_DURATION_S,
            distance_mi=0.0,
            start_lat=dropoff_lat,
            start_lon=dropoff_lon,
            end_lat=dropoff_lat,
            end_lon=dropoff_lon,
            polyline_index_end=dropoff_idx,
        )
    )

    return legs


def _emit_static_leg(state: PlannerState, leg: PlannedLeg, events: list[LogEvent]) -> PlannerState:
    """Emit a pickup or dropoff event (1h ON_DUTY_NOT_DRIVING).

    The cycle-cap rule may fire here when the driver is at 69h+ cycle hours.
    The 14-hour window does *count* this on-duty time (``advance`` extends
    ``drive_window_open_at``), but enforcement is lazy — §395.3(a)(2) bans
    driving past 14h, not on-duty-not-driving. The next driving leg's slicer
    catches a violation on the first iteration of ``_max_drive_chunk``.
    """
    cycle_event = apply_cycle_cap(state, leg)
    if cycle_event is not None:
        events.append(cycle_event)
        state = advance(state, cycle_event)

    note = "Pickup loading" if leg.kind == "pickup" else "Dropoff unloading"
    event = LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=state.now,
        duration=timedelta(seconds=leg.duration_s),
        location=_coord(leg.start_lat, leg.start_lon),
        note=note,
    )
    events.append(event)
    return advance(state, event)


def _drive_leg(state: PlannerState, leg: PlannedLeg, events: list[LogEvent]) -> PlannerState:
    """Drive ``leg``, slicing around any §395 constraint that fires mid-leg.

    Each iteration either emits a driving chunk (consuming some of the leg's
    remaining time) or emits a single constraint event (10h off, 30-min break,
    34h restart, or 15-min fuel stop) and advances state. The loop exits when
    the leg's remaining drive time hits zero.
    """
    remaining_s = leg.duration_s
    remaining_mi = leg.distance_mi
    speed_mph = (
        leg.distance_mi / (leg.duration_s / _SECONDS_PER_HOUR) if leg.duration_s > 0 else 0.0
    )
    cur_lat = leg.start_lat
    cur_lon = leg.start_lon

    while remaining_s > 0:
        chunk_s, constraint = _max_drive_chunk(state, remaining_s, speed_mph)
        if constraint is not None:
            chunk_s = (chunk_s // _SECONDS_PER_MINUTE) * _SECONDS_PER_MINUTE

        if chunk_s > 0:
            chunk_mi = chunk_s / _SECONDS_PER_HOUR * speed_mph
            if chunk_s >= remaining_s:
                chunk_s = remaining_s
                chunk_mi = remaining_mi
            event = LogEvent(
                status=DutyStatus.DRIVING,
                start=state.now,
                duration=timedelta(seconds=chunk_s),
                location=_coord(cur_lat, cur_lon),
                note="",
            )
            events.append(event)
            state = advance(state, event)
            state = replace(state, cum_miles=state.cum_miles + chunk_mi)
            remaining_s -= chunk_s
            remaining_mi -= chunk_mi
            if remaining_s > 0 and leg.distance_mi > 0:
                frac = 1.0 - (remaining_mi / leg.distance_mi)
                cur_lat = leg.start_lat + frac * (leg.end_lat - leg.start_lat)
                cur_lon = leg.start_lon + frac * (leg.end_lon - leg.start_lon)
            else:
                cur_lat, cur_lon = leg.end_lat, leg.end_lon
            if remaining_s <= 0:
                break

        if constraint is None:
            break

        rest_event, jump_lat, jump_lon = _make_constraint_event(state, constraint, cur_lat, cur_lon)
        events.append(rest_event)
        if constraint == "fuel":
            consumed_stop_mi = state.fuel_stops_remaining[0].cumulative_mi
            state = advance(state, rest_event)
            state = replace(
                state,
                fuel_stops_remaining=state.fuel_stops_remaining[1:],
                cum_miles=consumed_stop_mi,
            )
            cur_lat, cur_lon = jump_lat, jump_lon
        else:
            state = advance(state, rest_event)

    return state


_ConstraintKind = Literal["cycle", "window", "drive_limit", "break", "fuel"]


def _max_drive_chunk(
    state: PlannerState, remaining_s: int, speed_mph: float
) -> tuple[int, _ConstraintKind | None]:
    """Compute the largest contiguous drive chunk for the current state.

    Returns ``(chunk_seconds, next_constraint)``. ``next_constraint`` is the
    rule that ends the chunk; ``None`` means the chunk consumes the rest of the
    leg without hitting any constraint.
    """
    chunk_s = remaining_s
    constraint: _ConstraintKind | None = None

    cycle_avail_hours = CYCLE_LIMIT_HOURS - state.cycle_hours_used_total
    if cycle_avail_hours <= Decimal(0):
        return 0, "cycle"
    # ``Decimal * int`` returns ``Decimal``; ``int(Decimal)`` truncates toward zero.
    # Safe given the integer-minute duration contract (decision 6) — cycle hours land on
    # tenths-of-an-hour grid in the worst case, so the truncation never loses subsecond
    # accuracy. If durations ever go sub-minute, requantize before this conversion.
    t_cycle = int(cycle_avail_hours * _SECONDS_PER_HOUR)
    if t_cycle < chunk_s:
        chunk_s = t_cycle
        constraint = "cycle"

    if state.drive_window_open_at is not None:
        window_elapsed_s = (state.now - state.drive_window_open_at).total_seconds()
        t_window = int(DRIVE_WINDOW_LIMIT.total_seconds() - window_elapsed_s)
        if t_window <= 0:
            return 0, "window"
        if t_window < chunk_s:
            chunk_s = t_window
            constraint = "window"

    t_drive = int(
        DRIVE_LIMIT_PER_WINDOW.total_seconds() - state.cum_drive_in_window.total_seconds()
    )
    if t_drive <= 0:
        return 0, "drive_limit"
    if t_drive < chunk_s:
        chunk_s = t_drive
        constraint = "drive_limit"

    t_break = int(
        DRIVE_LIMIT_PER_BREAK.total_seconds() - state.cum_drive_since_break.total_seconds()
    )
    if t_break <= 0:
        return 0, "break"
    if t_break < chunk_s:
        chunk_s = t_break
        constraint = "break"

    if state.fuel_stops_remaining and speed_mph > 0:
        mi_to_fuel = state.fuel_stops_remaining[0].cumulative_mi - state.cum_miles
        if mi_to_fuel <= 0:
            return 0, "fuel"
        t_fuel = int(mi_to_fuel / speed_mph * _SECONDS_PER_HOUR)
        if t_fuel < chunk_s:
            chunk_s = t_fuel
            constraint = "fuel"

    return chunk_s, constraint


def _make_constraint_event(
    state: PlannerState,
    constraint: _ConstraintKind,
    cur_lat: float,
    cur_lon: float,
) -> tuple[LogEvent, float, float]:
    """Construct the rest/fuel event for ``constraint`` at the driver's position.

    Returns the event plus the lat/lon the driver is at AFTER the event (only
    differs from the input for fuel stops, where the driver advances to the
    fuel-stop vertex).
    """
    if constraint == "cycle":
        return (
            LogEvent(
                status=DutyStatus.OFF_DUTY,
                start=state.now,
                duration=RESTART_DURATION,
                location=_coord(cur_lat, cur_lon),
                note="34-hour restart (§395.3(c)(1))",
            ),
            cur_lat,
            cur_lon,
        )
    if constraint == "window":
        return (
            LogEvent(
                status=DutyStatus.OFF_DUTY,
                start=state.now,
                duration=TEN_HOUR_OFF,
                location=_coord(cur_lat, cur_lon),
                note="10-hour off-duty (§395.3(a)(2))",
            ),
            cur_lat,
            cur_lon,
        )
    if constraint == "drive_limit":
        return (
            LogEvent(
                status=DutyStatus.OFF_DUTY,
                start=state.now,
                duration=TEN_HOUR_OFF,
                location=_coord(cur_lat, cur_lon),
                note="10-hour off-duty (§395.3(a)(1))",
            ),
            cur_lat,
            cur_lon,
        )
    if constraint == "break":
        return (
            LogEvent(
                status=DutyStatus.OFF_DUTY,
                start=state.now,
                duration=THIRTY_MIN_BREAK,
                location=_coord(cur_lat, cur_lon),
                note="30-min break (§395.3(a)(3)(ii))",
            ),
            cur_lat,
            cur_lon,
        )
    stop = state.fuel_stops_remaining[0]
    return (
        LogEvent(
            status=DutyStatus.ON_DUTY_NOT_DRIVING,
            start=state.now,
            duration=FUEL_STOP_DURATION,
            location=_coord(stop.lat, stop.lon),
            note="Fueling",
        ),
        stop.lat,
        stop.lon,
    )
