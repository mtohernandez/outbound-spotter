"""Type validation: ``PlannerInputs.__post_init__`` raises, ``FuelStop`` round-trips."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from tests.hos.conftest import DEFAULT_HOME_TZ, DEFAULT_START_AT, make_directions
from web_api.hos.types import FuelStop, PlannerInputs
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
)


def test_planner_inputs_accepts_valid_payload() -> None:
    inputs = PlannerInputs(
        directions=make_directions([60.0, 280.0], [3600, 18000]),
        cycle_hours_used=Decimal("10.0"),
        start_at=DEFAULT_START_AT,
        home_terminal_tz=DEFAULT_HOME_TZ,
    )
    assert inputs.cycle_hours_used == Decimal("10.0")
    assert inputs.start_at.tzinfo is not None


def test_planner_inputs_rejects_negative_cycle_hours() -> None:
    with pytest.raises(ValueError, match="cycle_hours_used out of range"):
        PlannerInputs(
            directions=make_directions([60.0], [3600]),
            cycle_hours_used=Decimal("-0.1"),
            start_at=DEFAULT_START_AT,
            home_terminal_tz=DEFAULT_HOME_TZ,
        )


def test_planner_inputs_rejects_cycle_hours_over_seventy() -> None:
    with pytest.raises(ValueError, match="cycle_hours_used out of range"):
        PlannerInputs(
            directions=make_directions([60.0], [3600]),
            cycle_hours_used=Decimal("70.1"),
            start_at=DEFAULT_START_AT,
            home_terminal_tz=DEFAULT_HOME_TZ,
        )


def test_planner_inputs_rejects_naive_start_at() -> None:
    with pytest.raises(ValueError, match="start_at must be tz-aware"):
        PlannerInputs(
            directions=make_directions([60.0], [3600]),
            cycle_hours_used=Decimal("0.0"),
            start_at=datetime(2024, 4, 15, 6, 0),  # noqa: DTZ001 — intentional naive datetime
            home_terminal_tz=ZoneInfo("America/New_York"),
        )


def test_planner_inputs_rejects_zero_distance_directions() -> None:
    directions = DirectionsResult(
        polyline=[[-77.4360, 37.5407]],
        summary=DirectionsSummary(distance_mi=0.0, duration_s=0),
        segments=[DirectionsSegment(distance_mi=0.0, duration_s=0, from_index=0, to_index=0)],
    )
    with pytest.raises(ValueError, match=r"directions\.summary\.distance_mi must be positive"):
        PlannerInputs(
            directions=directions,
            cycle_hours_used=Decimal("0.0"),
            start_at=DEFAULT_START_AT,
            home_terminal_tz=DEFAULT_HOME_TZ,
        )


def test_planner_inputs_rejects_empty_polyline() -> None:
    directions = DirectionsResult(
        polyline=[],
        summary=DirectionsSummary(distance_mi=10.0, duration_s=600),
        segments=[DirectionsSegment(distance_mi=10.0, duration_s=600, from_index=0, to_index=0)],
    )
    with pytest.raises(ValueError, match="polyline must be non-empty"):
        PlannerInputs(
            directions=directions,
            cycle_hours_used=Decimal("0.0"),
            start_at=DEFAULT_START_AT,
            home_terminal_tz=DEFAULT_HOME_TZ,
        )


def test_fuel_stop_round_trips_via_asdict() -> None:
    stop = FuelStop(polyline_index=42, cumulative_mi=1000.5, lat=39.1234, lon=-78.5678)
    payload = asdict(stop)
    assert payload == {
        "polyline_index": 42,
        "cumulative_mi": 1000.5,
        "lat": 39.1234,
        "lon": -78.5678,
    }
