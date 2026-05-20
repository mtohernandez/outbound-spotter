"""Planner state ladder. Frozen + slotted; ``advance`` returns a NEW state.

The state captures every counter §395.3 references. Tests can hold a list of
intermediate states and assert mid-trip invariants without deepcopy ceremony.
See ``context/specs/05-hos-planner-foundation.md`` decision 2.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from web_api.hos.fueling import fuel_stop_indices
from web_api.hos.types import DutyStatus

if TYPE_CHECKING:
    from datetime import datetime

    from web_api.hos.types import FuelStop, LogEvent, PlannerInputs


WINDOW_CLOSE_THRESHOLD: timedelta = timedelta(hours=10)
CYCLE_RESTART_THRESHOLD: timedelta = timedelta(hours=34)
BREAK_RESET_THRESHOLD: timedelta = timedelta(minutes=30)
_SECONDS_PER_HOUR: Decimal = Decimal("3600")


def _seconds_to_hours(seconds: float) -> Decimal:
    """Lossless seconds → hours for integer-minute durations (decision 6).

    The planner's duration contract is whole minutes (every emitted ``LogEvent``
    has ``duration.total_seconds() % 60 == 0``), so ``str(seconds)`` produces
    an exact base-10 representation and ``Decimal(str(...))`` round-trips.
    """
    return Decimal(str(seconds)) / _SECONDS_PER_HOUR


@dataclass(frozen=True, slots=True)
class PlannerState:
    """Immutable snapshot of every §395 counter at a point in the trip."""

    now: datetime
    drive_window_open_at: datetime | None
    cum_drive_in_window: timedelta
    cum_drive_since_break: timedelta
    cycle_hours_used_total: Decimal
    last_status: DutyStatus | None
    last_status_started_at: datetime | None
    polyline_cursor: int
    cum_miles: float
    fuel_stops_remaining: tuple[FuelStop, ...] = field(default_factory=tuple)

    @classmethod
    def initial(cls, inputs: PlannerInputs) -> PlannerState:
        stops = tuple(fuel_stop_indices(inputs.directions.polyline, inputs.directions.segments))
        return cls(
            now=inputs.start_at,
            drive_window_open_at=None,
            cum_drive_in_window=timedelta(0),
            cum_drive_since_break=timedelta(0),
            cycle_hours_used_total=inputs.cycle_hours_used,
            last_status=None,
            last_status_started_at=None,
            polyline_cursor=0,
            cum_miles=0.0,
            fuel_stops_remaining=stops,
        )


def advance(state: PlannerState, event: LogEvent) -> PlannerState:
    """Apply ``event`` and return a new state. Pure function.

    Transition rules implement §395.3(a) counters + §395.3(c)(1) restart. The
    sleeper-berth duty status is treated equivalently to off-duty for window /
    cycle / break purposes per decision 9 (split-sleeper pairing options 2 & 3
    of §395.1(g) are deferred). Off-duty / sleeper events shorter than 30 min
    do NOT reset the break counter — §395.3(a)(3)(ii) requires a *consecutive*
    30-minute break.
    """
    now = event.start + event.duration

    if event.status == DutyStatus.DRIVING:
        hours = _seconds_to_hours(event.duration.total_seconds())
        return replace(
            state,
            now=now,
            drive_window_open_at=state.drive_window_open_at or event.start,
            cum_drive_in_window=state.cum_drive_in_window + event.duration,
            cum_drive_since_break=state.cum_drive_since_break + event.duration,
            cycle_hours_used_total=state.cycle_hours_used_total + hours,
            last_status=event.status,
            last_status_started_at=event.start,
        )

    if event.status == DutyStatus.ON_DUTY_NOT_DRIVING:
        hours = _seconds_to_hours(event.duration.total_seconds())
        return replace(
            state,
            now=now,
            drive_window_open_at=state.drive_window_open_at or event.start,
            cycle_hours_used_total=state.cycle_hours_used_total + hours,
            last_status=event.status,
            last_status_started_at=event.start,
        )

    # OFF_DUTY or SLEEPER_BERTH — apply the largest applicable reset.
    duration = event.duration
    if duration >= CYCLE_RESTART_THRESHOLD:
        return replace(
            state,
            now=now,
            drive_window_open_at=None,
            cum_drive_in_window=timedelta(0),
            cum_drive_since_break=timedelta(0),
            cycle_hours_used_total=Decimal("0.0"),
            last_status=event.status,
            last_status_started_at=event.start,
        )
    if duration >= WINDOW_CLOSE_THRESHOLD:
        return replace(
            state,
            now=now,
            drive_window_open_at=None,
            cum_drive_in_window=timedelta(0),
            cum_drive_since_break=timedelta(0),
            last_status=event.status,
            last_status_started_at=event.start,
        )
    if duration >= BREAK_RESET_THRESHOLD:
        return replace(
            state,
            now=now,
            cum_drive_since_break=timedelta(0),
            last_status=event.status,
            last_status_started_at=event.start,
        )
    return replace(
        state,
        now=now,
        last_status=event.status,
        last_status_started_at=event.start,
    )
