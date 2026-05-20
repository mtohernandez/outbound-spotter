"""State transitions: frozen, ``advance`` is pure, §395 counters update correctly."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from tests.hos.conftest import DEFAULT_START_AT, make_directions, make_planner_inputs, make_state
from web_api.hos.state import PlannerState, advance
from web_api.hos.types import DutyStatus, LogEvent


def _drive(start: datetime, duration: timedelta) -> LogEvent:
    return LogEvent(
        status=DutyStatus.DRIVING,
        start=start,
        duration=duration,
        location="0.0000, 0.0000",
    )


def _off_duty(start: datetime, duration: timedelta) -> LogEvent:
    return LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=start,
        duration=duration,
        location="0.0000, 0.0000",
    )


def _sleeper(start: datetime, duration: timedelta) -> LogEvent:
    return LogEvent(
        status=DutyStatus.SLEEPER_BERTH,
        start=start,
        duration=duration,
        location="0.0000, 0.0000",
    )


def _on_duty(start: datetime, duration: timedelta) -> LogEvent:
    return LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=start,
        duration=duration,
        location="0.0000, 0.0000",
    )


def test_planner_state_is_frozen() -> None:
    state = make_state()
    with pytest.raises(FrozenInstanceError):
        state.cum_drive_in_window = timedelta(hours=1)  # type: ignore[misc]


def test_advance_does_not_mutate_input_state() -> None:
    state = make_state()
    event = _drive(state.now, timedelta(hours=1))
    new_state = advance(state, event)
    assert state.cum_drive_in_window == timedelta(0)
    assert new_state.cum_drive_in_window == timedelta(hours=1)
    assert state.now == DEFAULT_START_AT
    assert new_state.now == DEFAULT_START_AT + timedelta(hours=1)


def test_driving_opens_window_and_bumps_counters() -> None:
    state = make_state()
    event = _drive(state.now, timedelta(hours=2))
    new_state = advance(state, event)
    assert new_state.drive_window_open_at == state.now
    assert new_state.cum_drive_in_window == timedelta(hours=2)
    assert new_state.cum_drive_since_break == timedelta(hours=2)
    assert new_state.cycle_hours_used_total == Decimal("2.0")
    assert new_state.last_status == DutyStatus.DRIVING


def test_on_duty_not_driving_opens_window_but_does_not_bump_drive_counters() -> None:
    state = make_state()
    event = _on_duty(state.now, timedelta(hours=1))
    new_state = advance(state, event)
    assert new_state.drive_window_open_at == state.now
    assert new_state.cum_drive_in_window == timedelta(0)
    assert new_state.cum_drive_since_break == timedelta(0)
    assert new_state.cycle_hours_used_total == Decimal("1.0")


def test_ten_hour_off_duty_closes_window_resets_drive_counters() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=8),
        cum_drive_since_break=timedelta(hours=5),
        cycle_hours_used_total=Decimal("12.0"),
    )
    event = _off_duty(state.now, timedelta(hours=10))
    new_state = advance(state, event)
    assert new_state.drive_window_open_at is None
    assert new_state.cum_drive_in_window == timedelta(0)
    assert new_state.cum_drive_since_break == timedelta(0)
    # Cycle hours persist — only 34h restart resets them.
    assert new_state.cycle_hours_used_total == Decimal("12.0")


def test_thirty_minute_off_duty_resets_break_only() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=8),
        cum_drive_since_break=timedelta(hours=8),
        cycle_hours_used_total=Decimal("8.0"),
    )
    event = _off_duty(state.now, timedelta(minutes=30))
    new_state = advance(state, event)
    assert new_state.cum_drive_since_break == timedelta(0)
    # Window stays open, drive counter persists (under 10h reset threshold).
    assert new_state.drive_window_open_at == DEFAULT_START_AT
    assert new_state.cum_drive_in_window == timedelta(hours=8)
    assert new_state.cycle_hours_used_total == Decimal("8.0")


def test_short_off_duty_below_thirty_min_does_not_reset_break_counter() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=4),
        cum_drive_since_break=timedelta(hours=4),
    )
    event = _off_duty(state.now, timedelta(minutes=20))
    new_state = advance(state, event)
    assert new_state.cum_drive_since_break == timedelta(hours=4)
    assert new_state.last_status == DutyStatus.OFF_DUTY


def test_thirty_four_hour_off_duty_restarts_cycle() -> None:
    state = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=11),
        cum_drive_since_break=timedelta(hours=8),
        cycle_hours_used_total=Decimal("65.0"),
    )
    event = _off_duty(state.now, timedelta(hours=34))
    new_state = advance(state, event)
    assert new_state.cycle_hours_used_total == Decimal("0.0")
    assert new_state.drive_window_open_at is None
    assert new_state.cum_drive_in_window == timedelta(0)
    assert new_state.cum_drive_since_break == timedelta(0)


def test_advance_sleeper_berth_equivalent_to_off_duty() -> None:
    """Architect-review m3: SLEEPER_BERTH and OFF_DUTY share the reset semantics."""
    base = make_state(
        drive_window_open_at=DEFAULT_START_AT,
        cum_drive_in_window=timedelta(hours=11),
        cum_drive_since_break=timedelta(hours=8),
        cycle_hours_used_total=Decimal("65.0"),
    )

    sleeper_10h = _sleeper(base.now, timedelta(hours=10))
    after_sleeper_10h = advance(base, sleeper_10h)
    assert after_sleeper_10h.drive_window_open_at is None
    assert after_sleeper_10h.cum_drive_in_window == timedelta(0)
    assert after_sleeper_10h.cum_drive_since_break == timedelta(0)
    assert after_sleeper_10h.cycle_hours_used_total == Decimal("65.0")

    sleeper_34h = _sleeper(base.now, timedelta(hours=34))
    after_sleeper_34h = advance(base, sleeper_34h)
    assert after_sleeper_34h.cycle_hours_used_total == Decimal("0.0")
    assert after_sleeper_34h.drive_window_open_at is None

    sleeper_30min = _sleeper(base.now, timedelta(minutes=30))
    after_sleeper_30min = advance(base, sleeper_30min)
    assert after_sleeper_30min.cum_drive_since_break == timedelta(0)
    assert after_sleeper_30min.drive_window_open_at == DEFAULT_START_AT


def test_initial_state_from_planner_inputs_with_no_fuel_stops() -> None:
    inputs = make_planner_inputs()  # ~340 mi total — no fueling needed
    state = PlannerState.initial(inputs)
    assert state.now == inputs.start_at
    assert state.drive_window_open_at is None
    assert state.cycle_hours_used_total == Decimal("0.0")
    assert state.fuel_stops_remaining == ()
    assert state.cum_miles == 0.0


def test_initial_state_includes_pre_computed_fuel_stops_for_long_trips() -> None:
    inputs = make_planner_inputs(
        directions=make_directions([0.0, 1500.0], [0, 22 * 3600]),
    )
    state = PlannerState.initial(inputs)
    assert len(state.fuel_stops_remaining) == 1
    assert 950.0 < state.fuel_stops_remaining[0].cumulative_mi < 1050.0


def test_now_in_event_zone_is_preserved_across_advance() -> None:
    state = make_state(now=datetime(2024, 4, 15, 6, 0, tzinfo=ZoneInfo("America/New_York")))
    event = _drive(state.now, timedelta(hours=2))
    new_state = advance(state, event)
    assert new_state.now.tzinfo == ZoneInfo("America/New_York")
    assert new_state.now.hour == 8
