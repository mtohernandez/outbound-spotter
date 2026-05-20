"""Per-rule §395 unit tests.

Each rule gets at least three cases: boundary-not-yet-triggered,
boundary-just-triggered, boundary-already-past. The rule functions check
the WHOLE leg against the current state; long-haul slicing happens in
``planner.py`` and is exercised by the golden tests.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from tests.hos.conftest import DEFAULT_START_AT, make_state
from web_api.hos.planner import PlannedLeg
from web_api.hos.rules import (
    apply_break,
    apply_cycle_cap,
    apply_drive_limit,
    apply_fuel_stop,
    apply_off_duty_window,
    apply_restart_recovery,
)
from web_api.hos.types import DutyStatus, FuelStop


def _driving_leg(duration_s: int, *, distance_mi: float = 0.0) -> PlannedLeg:
    return PlannedLeg(
        kind="driving",
        duration_s=duration_s,
        distance_mi=distance_mi,
        start_lat=37.5,
        start_lon=-77.5,
        end_lat=38.5,
        end_lon=-77.5,
        polyline_index_end=10,
    )


def _pickup_leg() -> PlannedLeg:
    return PlannedLeg(
        kind="pickup",
        duration_s=3600,
        distance_mi=0.0,
        start_lat=37.5,
        start_lon=-77.5,
        end_lat=37.5,
        end_lon=-77.5,
        polyline_index_end=10,
    )


def test_drive_limit_does_not_fire_below_eleven_hours() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=10, minutes=30),
    )
    leg = _driving_leg(duration_s=20 * 60)  # 20 min — total 10h50m, under 11h
    assert apply_drive_limit(state, leg) is None


def test_drive_limit_fires_when_total_exceeds_eleven_hours() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=10, minutes=30),
    )
    leg = _driving_leg(duration_s=2 * 3600)  # 2h — total 12h30m, over 11h
    event = apply_drive_limit(state, leg)
    assert event is not None
    assert event.status == DutyStatus.OFF_DUTY
    assert event.duration == timedelta(hours=10)
    assert "§395.3(a)(1)" in event.note


def test_drive_limit_does_not_apply_to_pickup() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=20),
    )
    assert apply_drive_limit(state, _pickup_leg()) is None


def test_off_duty_window_does_not_fire_with_no_window_open() -> None:
    state = make_state(drive_window_open_at=None)
    assert apply_off_duty_window(state, _driving_leg(duration_s=4 * 3600)) is None


def test_off_duty_window_does_not_fire_below_fourteen_hours() -> None:
    state = make_state(
        now=DEFAULT_START_AT + timedelta(hours=13),
        drive_window_open_at=DEFAULT_START_AT,
    )
    leg = _driving_leg(duration_s=30 * 60)  # 30 min — total 13h30m
    assert apply_off_duty_window(state, leg) is None


def test_off_duty_window_fires_when_leg_would_cross_fourteen_hour_mark() -> None:
    state = make_state(
        now=DEFAULT_START_AT + timedelta(hours=13),
        drive_window_open_at=DEFAULT_START_AT,
    )
    leg = _driving_leg(duration_s=2 * 3600)  # 2h — total 15h
    event = apply_off_duty_window(state, leg)
    assert event is not None
    assert event.duration == timedelta(hours=10)
    assert "§395.3(a)(2)" in event.note


def test_break_does_not_fire_below_eight_hours_drive_since_break() -> None:
    state = make_state(cum_drive_since_break=timedelta(hours=7, minutes=30))
    leg = _driving_leg(duration_s=20 * 60)  # 20 min — total 7h50m
    assert apply_break(state, leg) is None


def test_break_fires_when_leg_would_cross_eight_hour_mark() -> None:
    state = make_state(cum_drive_since_break=timedelta(hours=7, minutes=30))
    leg = _driving_leg(duration_s=2 * 3600)  # 2h — total 9h30m
    event = apply_break(state, leg)
    assert event is not None
    assert event.duration == timedelta(minutes=30)
    assert "§395.3(a)(3)(ii)" in event.note


def test_break_does_not_apply_to_pickup() -> None:
    state = make_state(cum_drive_since_break=timedelta(hours=20))
    assert apply_break(state, _pickup_leg()) is None


def test_cycle_cap_does_not_fire_below_seventy_hours() -> None:
    state = make_state(cycle_hours_used_total=Decimal("69.0"))
    leg = _driving_leg(duration_s=3600)  # 1h — total 70.0, NOT > 70
    assert apply_cycle_cap(state, leg) is None


def test_cycle_cap_fires_when_leg_would_cross_seventy_hours() -> None:
    state = make_state(cycle_hours_used_total=Decimal("69.5"))
    leg = _driving_leg(duration_s=3600)  # 1h — total 70.5, > 70
    event = apply_cycle_cap(state, leg)
    assert event is not None
    assert event.duration == timedelta(hours=34)
    assert "§395.3(c)(1)" in event.note


def test_cycle_cap_applies_to_pickup_legs() -> None:
    """Pickup is ON_DUTY_NOT_DRIVING — counts toward the 70-hour cap (§395.3(b))."""
    state = make_state(cycle_hours_used_total=Decimal("69.5"))
    event = apply_cycle_cap(state, _pickup_leg())
    assert event is not None
    assert event.duration == timedelta(hours=34)


def test_restart_recovery_builds_a_thirty_four_hour_off_duty_block() -> None:
    state = make_state()
    event = apply_restart_recovery(state, _driving_leg(duration_s=3600))
    assert event.status == DutyStatus.OFF_DUTY
    assert event.duration == timedelta(hours=34)
    assert event.start == state.now


def test_fuel_stop_does_not_fire_without_remaining_stops() -> None:
    state = make_state(cum_miles=500.0, fuel_stops_remaining=())
    leg = _driving_leg(duration_s=3600, distance_mi=70.0)
    assert apply_fuel_stop(state, leg) is None


def test_fuel_stop_does_not_fire_when_leg_falls_short_of_next_threshold() -> None:
    state = make_state(
        cum_miles=500.0,
        fuel_stops_remaining=(
            FuelStop(polyline_index=42, cumulative_mi=1000.0, lat=38.5, lon=-77.5),
        ),
    )
    leg = _driving_leg(duration_s=3600, distance_mi=200.0)  # ends at 700 mi
    assert apply_fuel_stop(state, leg) is None


def test_fuel_stop_fires_when_leg_crosses_next_threshold() -> None:
    state = make_state(
        cum_miles=950.0,
        fuel_stops_remaining=(
            FuelStop(polyline_index=42, cumulative_mi=1000.0, lat=38.5, lon=-77.5),
        ),
    )
    leg = _driving_leg(duration_s=3600, distance_mi=100.0)  # ends at 1050 mi
    event = apply_fuel_stop(state, leg)
    assert event is not None
    assert event.status == DutyStatus.ON_DUTY_NOT_DRIVING
    assert event.duration == timedelta(minutes=15)
    assert event.note == "Fueling"


def test_fuel_stop_does_not_apply_to_pickup() -> None:
    state = make_state(
        cum_miles=500.0,
        fuel_stops_remaining=(
            FuelStop(polyline_index=42, cumulative_mi=1000.0, lat=38.5, lon=-77.5),
        ),
    )
    assert apply_fuel_stop(state, _pickup_leg()) is None
