"""Adapter tests — ``hos_adapter.materialize_plan``.

These exercise the projection from planner ``LogEvent``s into Django rows.
The planner itself is mocked to return canned events; planner correctness is
covered by the §395-cited goldens under ``tests/hos/``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from web_api.apps.trips import hos_adapter
from web_api.apps.trips.models import (
    DutyStatusChoices,
    LogDay,
    LogEvent,
    StopKind,
    TripStop,
)
from web_api.hos import DutyStatus, FuelStop, LogEvent as HosLogEvent

if TYPE_CHECKING:
    from tests.conftest import TripFactory


_TZ_UTC = UTC


def _make_richmond_to_newark_events() -> list[HosLogEvent]:
    """5 events for the assessment golden Richmond → Fredericksburg → Newark."""
    start = datetime(2030, 1, 15, 13, 0, 0, tzinfo=_TZ_UTC)
    return [
        HosLogEvent(
            status=DutyStatus.DRIVING,
            start=start,
            duration=timedelta(hours=1, minutes=12),
            location="37.5407, -77.4360",
            note="",
        ),
        HosLogEvent(
            status=DutyStatus.ON_DUTY_NOT_DRIVING,
            start=start + timedelta(hours=1, minutes=12),
            duration=timedelta(hours=1),
            location="38.3032, -77.4605",
            note="Pickup loading",
        ),
        HosLogEvent(
            status=DutyStatus.DRIVING,
            start=start + timedelta(hours=2, minutes=12),
            duration=timedelta(hours=5),
            location="38.3032, -77.4605",
            note="",
        ),
        HosLogEvent(
            status=DutyStatus.ON_DUTY_NOT_DRIVING,
            start=start + timedelta(hours=7, minutes=12),
            duration=timedelta(hours=1),
            location="40.7357, -74.1724",
            note="Dropoff unloading",
        ),
        HosLogEvent(
            status=DutyStatus.OFF_DUTY,
            start=start + timedelta(hours=8, minutes=12),
            duration=timedelta(hours=10),
            location="40.7357, -74.1724",
            note="10-hour off-duty (§395.3(a)(1))",
        ),
    ]


@pytest.mark.django_db
def test_materialize_plan_emits_one_log_event_per_planner_event(
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()
    events = _make_richmond_to_newark_events()
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)

    assert LogEvent.objects.filter(trip=trip).count() == len(events)
    persisted = list(LogEvent.objects.filter(trip=trip).order_by("sequence"))
    assert persisted[0].status == DutyStatusChoices.DRIVING
    assert persisted[1].note == "Pickup loading"
    assert persisted[3].note == "Dropoff unloading"
    assert persisted[4].status == DutyStatusChoices.OFF_DUTY


@pytest.mark.django_db
def test_materialize_plan_emits_pickup_dropoff_off_duty_stops(
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()
    events = _make_richmond_to_newark_events()
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)

    stops = list(TripStop.objects.filter(trip=trip).order_by("sequence"))
    kinds = [stop.kind for stop in stops]
    assert kinds == [StopKind.PICKUP, StopKind.DROPOFF, StopKind.SLEEPER]


@pytest.mark.django_db
def test_stop_scheduled_at_matches_originating_event_start(
    trip_factory: type[TripFactory],
) -> None:
    """Architect-review m7 contract: TripStop.scheduled_at == LogEvent.start."""
    trip = trip_factory.create()
    events = _make_richmond_to_newark_events()
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)

    stops_by_kind = {stop.kind: stop for stop in TripStop.objects.filter(trip=trip)}
    pickup_event = events[1]
    dropoff_event = events[3]
    assert stops_by_kind[StopKind.PICKUP].scheduled_at == pickup_event.start
    assert stops_by_kind[StopKind.PICKUP].duration_s == int(pickup_event.duration.total_seconds())
    assert stops_by_kind[StopKind.DROPOFF].scheduled_at == dropoff_event.start


@pytest.mark.django_db
def test_fuel_stops_consume_precomputed_polyline_indices(
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()
    start = datetime(2030, 1, 15, 13, 0, 0, tzinfo=_TZ_UTC)
    events = [
        HosLogEvent(
            status=DutyStatus.DRIVING,
            start=start,
            duration=timedelta(hours=10),
            location="37.5407, -77.4360",
            note="",
        ),
        HosLogEvent(
            status=DutyStatus.ON_DUTY_NOT_DRIVING,
            start=start + timedelta(hours=10),
            duration=timedelta(minutes=15),
            location="39.0, -77.0",
            note="Fueling",
        ),
    ]
    fuel = FuelStop(polyline_index=42, cumulative_mi=500.0, lat=39.0, lon=-77.0)
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[fuel]),
    ):
        hos_adapter.materialize_plan(trip)

    fuel_stop = TripStop.objects.get(trip=trip, kind=StopKind.FUEL)
    assert fuel_stop.polyline_index == 42
    assert fuel_stop.lat == Decimal("39.000000")
    assert fuel_stop.lon == Decimal("-77.000000")


@pytest.mark.django_db
def test_duty_status_translation_uses_value(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    events = _make_richmond_to_newark_events()
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)

    statuses = {ev.status for ev in LogEvent.objects.filter(trip=trip)}
    assert DutyStatusChoices.DRIVING in statuses
    assert DutyStatusChoices.ON_DUTY_NOT_DRIVING in statuses
    assert DutyStatusChoices.OFF_DUTY in statuses


@pytest.mark.django_db
def test_log_day_totals_sum_to_event_seconds_for_single_day(
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()
    events = _make_richmond_to_newark_events()
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)

    days = list(LogDay.objects.filter(trip=trip).order_by("date"))
    assert len(days) >= 1
    total_seconds = sum(
        day.off_duty_s + day.sleeper_s + day.driving_s + day.on_duty_not_driving_s for day in days
    )
    expected = sum(int(e.duration.total_seconds()) for e in events)
    assert total_seconds == expected


@pytest.mark.django_db
def test_midnight_crossing_drive_splits_seconds_proportionally(
    trip_factory: type[TripFactory],
) -> None:
    """Architect-review m1: a single LogEvent spans 2 LogDay buckets."""
    trip = trip_factory.create()
    # 22:00 EST on day-1 → 03:00 EST on day-2 — 5h drive spanning midnight.
    # 22:00 EST is 03:00 UTC next day, but easier to reason in UTC: 23:00 UTC
    # day-1 is 18:00 EST day-1; let's use a clearer setup. Start at 03:00 UTC
    # on Jan 15 (22:00 EST Jan 14) and run 5h → 08:00 UTC Jan 15 (03:00 EST
    # Jan 15). HOME_TERMINAL_TZ is America/New_York; the home-terminal-local
    # dates are Jan 14 (22:00-24:00 EST = 2h) and Jan 15 (00:00-03:00 EST = 3h).
    start = datetime(2030, 1, 15, 3, 0, 0, tzinfo=_TZ_UTC)
    events = [
        HosLogEvent(
            status=DutyStatus.DRIVING,
            start=start,
            duration=timedelta(hours=5),
            location="40.0, -75.0",
            note="",
        ),
    ]
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)

    days = {day.date: day for day in LogDay.objects.filter(trip=trip)}
    # 2h of driving on Jan 14, 3h on Jan 15 (home-terminal-local dates).
    assert days[datetime(2030, 1, 14, tzinfo=UTC).date()].driving_s == 2 * 3600
    assert days[datetime(2030, 1, 15, tzinfo=UTC).date()].driving_s == 3 * 3600
    # LogEvent itself is one row across the boundary (invariant #2).
    assert LogEvent.objects.filter(trip=trip).count() == 1


@pytest.mark.django_db
def test_single_shot_contract_raises_on_second_call(
    trip_factory: type[TripFactory],
) -> None:
    """Calling materialize_plan twice on the same trip violates unique seq."""
    from django.db import IntegrityError  # noqa: PLC0415

    trip = trip_factory.create()
    events = _make_richmond_to_newark_events()
    with (
        patch.object(hos_adapter, "plan_logs", return_value=events),
        patch.object(hos_adapter, "fuel_stop_indices", return_value=[]),
    ):
        hos_adapter.materialize_plan(trip)
        with pytest.raises(IntegrityError):
            hos_adapter.materialize_plan(trip)
