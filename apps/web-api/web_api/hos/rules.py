"""Per-rule §395 functions. Each emits at most one ``LogEvent`` per call.

These predicates encode each regulation as a single source of truth.
``apply_cycle_cap`` is called directly by ``planner._emit_static_leg`` on
pickup / dropoff legs (which skip the slicing loop). The remaining five
predicates (off-duty-window, drive-limit, break, fuel-stop, restart-recovery)
are exercised by ``test_rules.py`` and serve as the auditable §395 surface
for external readers; ``planner._max_drive_chunk`` re-derives the same
thresholds from the shared module-level constants (``DRIVE_LIMIT_PER_WINDOW``
etc.) so the slicing loop produces the same emit decisions without calling
the predicates directly. Keeping the constants in one place ensures both
surfaces track in lockstep.

Composition order when both layers run on the same leg: cycle_cap →
off_duty_window → drive_limit → break → fuel_stop → emit_leg. Cycle cap runs
FIRST so its 34h restart subsumes any 10h off-duty the subsequent rules would
otherwise emit at the same boundary (architect-review M2 in the spec).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from web_api.hos.types import DutyStatus, LogEvent

if TYPE_CHECKING:
    from web_api.hos.planner import PlannedLeg
    from web_api.hos.state import PlannerState


DRIVE_WINDOW_LIMIT: timedelta = timedelta(hours=14)
DRIVE_LIMIT_PER_WINDOW: timedelta = timedelta(hours=11)
DRIVE_LIMIT_PER_BREAK: timedelta = timedelta(hours=8)
TEN_HOUR_OFF: timedelta = timedelta(hours=10)
THIRTY_MIN_BREAK: timedelta = timedelta(minutes=30)
FUEL_STOP_DURATION: timedelta = timedelta(minutes=15)
RESTART_DURATION: timedelta = timedelta(hours=34)
CYCLE_LIMIT_HOURS: Decimal = Decimal("70.0")


def _coord(lat: float, lon: float) -> str:
    return f"{lat:.4f}, {lon:.4f}"


def _here(leg: PlannedLeg) -> str:
    return _coord(leg.start_lat, leg.start_lon)


def apply_cycle_cap(state: PlannerState, leg: PlannedLeg) -> LogEvent | None:
    """§395.3(b) — 70-hour / 8-day on-duty limit.

    If the proposed leg's on-duty hours would push the rolling total past 70,
    emit a 34-hour restart per §395.3(c)(1). Cite:
    ``docs/interstate-truck-driver-guide.md:137-159``.
    """
    on_duty_hours = Decimal(leg.duration_s) / Decimal(3600)
    if state.cycle_hours_used_total + on_duty_hours <= CYCLE_LIMIT_HOURS:
        return None
    return apply_restart_recovery(state, leg)


def apply_restart_recovery(state: PlannerState, leg: PlannedLeg) -> LogEvent:
    """§395.3(c)(1) — 34-hour restart.

    Resets the 70/8 clock. Constructed by ``apply_cycle_cap``; cited
    separately so the regulation reference is explicit. Cite:
    ``docs/interstate-truck-driver-guide.md:156-159``.
    """
    return LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=state.now,
        duration=RESTART_DURATION,
        location=_here(leg),
        note="34-hour restart (§395.3(c)(1))",
    )


def apply_off_duty_window(state: PlannerState, leg: PlannedLeg) -> LogEvent | None:
    """§395.3(a)(2) — 14-hour driving window.

    If the leg would drive past 14 consecutive hours since the window opened,
    emit a 10-hour off-duty block first. The window closes and a new shift
    begins after that. Cite: ``docs/interstate-truck-driver-guide.md:87-91``.
    """
    if leg.kind != "driving" or state.drive_window_open_at is None:
        return None
    leg_duration = timedelta(seconds=leg.duration_s)
    if state.now + leg_duration <= state.drive_window_open_at + DRIVE_WINDOW_LIMIT:
        return None
    return LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=state.now,
        duration=TEN_HOUR_OFF,
        location=_here(leg),
        note="10-hour off-duty (§395.3(a)(2))",
    )


def apply_drive_limit(state: PlannerState, leg: PlannedLeg) -> LogEvent | None:
    """§395.3(a)(1) — 11-hour driving limit.

    If the leg would push cumulative driving in this window past 11 hours,
    emit a 10-hour off-duty block first. Cite:
    ``docs/interstate-truck-driver-guide.md:93-97``.
    """
    if leg.kind != "driving":
        return None
    leg_duration = timedelta(seconds=leg.duration_s)
    if state.cum_drive_in_window + leg_duration <= DRIVE_LIMIT_PER_WINDOW:
        return None
    return LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=state.now,
        duration=TEN_HOUR_OFF,
        location=_here(leg),
        note="10-hour off-duty (§395.3(a)(1))",
    )


def apply_break(state: PlannerState, leg: PlannedLeg) -> LogEvent | None:
    """§395.3(a)(3)(ii) — 30-minute break after 8 cumulative driving hours.

    If the leg would push driving-since-last-break past 8 hours, emit a
    30-minute off-duty break first. Cite:
    ``docs/interstate-truck-driver-guide.md:127-133``.
    """
    if leg.kind != "driving":
        return None
    leg_duration = timedelta(seconds=leg.duration_s)
    if state.cum_drive_since_break + leg_duration <= DRIVE_LIMIT_PER_BREAK:
        return None
    return LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=state.now,
        duration=THIRTY_MIN_BREAK,
        location=_here(leg),
        note="30-min break (§395.3(a)(3)(ii))",
    )


def apply_fuel_stop(state: PlannerState, leg: PlannedLeg) -> LogEvent | None:
    """``docs/assesment.md:18`` — fueling at least every 1,000 miles.

    Positional, not temporal: if the next driving leg would cross the next
    pre-computed fuel-threshold polyline vertex, emit a 15-minute
    ``ON_DUTY_NOT_DRIVING`` event AT that vertex. The planner re-slices the
    leg around the fuel stop.
    """
    if leg.kind != "driving" or not state.fuel_stops_remaining:
        return None
    next_stop = state.fuel_stops_remaining[0]
    if state.cum_miles + leg.distance_mi < next_stop.cumulative_mi:
        return None
    return LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=state.now,
        duration=FUEL_STOP_DURATION,
        location=_coord(next_stop.lat, next_stop.lon),
        note="Fueling",
    )
