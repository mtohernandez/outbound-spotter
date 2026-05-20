"""Model-layer tests for the three new plan tables.

Constraints + cascade behavior live close to the DB; the adapter / view tests
exercise the rows through their natural callers. These tests are intentionally
narrow.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import IntegrityError
import pytest

from web_api.apps.trips.models import (
    DutyStatusChoices,
    LogDay,
    LogEvent,
    StopKind,
    Trip,
    TripStop,
)

if TYPE_CHECKING:
    from tests.conftest import TripFactory


@pytest.mark.django_db
def test_trip_stop_unique_sequence_per_trip(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    TripStop.objects.create(
        trip=trip,
        kind=StopKind.PICKUP,
        sequence=0,
        polyline_index=1,
        lat=Decimal("38.303200"),
        lon=Decimal("-77.460500"),
        label="",
        scheduled_at=datetime(2030, 1, 15, 13, 0, tzinfo=UTC),
        duration_s=3600,
    )
    with pytest.raises(IntegrityError):
        TripStop.objects.create(
            trip=trip,
            kind=StopKind.DROPOFF,
            sequence=0,  # duplicate (trip, sequence)
            polyline_index=2,
            lat=Decimal("40.735700"),
            lon=Decimal("-74.172400"),
            label="",
            scheduled_at=datetime(2030, 1, 15, 17, 0, tzinfo=UTC),
            duration_s=3600,
        )


@pytest.mark.django_db
def test_log_event_unique_sequence_per_trip(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    LogEvent.objects.create(
        trip=trip,
        sequence=0,
        status=DutyStatusChoices.DRIVING,
        start=datetime(2030, 1, 15, 13, 0, tzinfo=UTC),
        duration_s=3600,
        location="37.5407, -77.4360",
        note="",
    )
    with pytest.raises(IntegrityError):
        LogEvent.objects.create(
            trip=trip,
            sequence=0,
            status=DutyStatusChoices.OFF_DUTY,
            start=datetime(2030, 1, 15, 14, 0, tzinfo=UTC),
            duration_s=1800,
            location="38.3032, -77.4605",
            note="30-min break",
        )


@pytest.mark.django_db
def test_log_day_unique_date_per_trip(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    LogDay.objects.create(
        trip=trip,
        date=datetime(2030, 1, 15, tzinfo=UTC).date(),
        off_duty_s=0,
        sleeper_s=0,
        driving_s=28800,
        on_duty_not_driving_s=3600,
        total_miles=Decimal("342.7"),
    )
    with pytest.raises(IntegrityError):
        LogDay.objects.create(
            trip=trip,
            date=datetime(2030, 1, 15, tzinfo=UTC).date(),  # duplicate (trip, date)
            off_duty_s=86400,
            sleeper_s=0,
            driving_s=0,
            on_duty_not_driving_s=0,
            total_miles=Decimal("0.0"),
        )


@pytest.mark.django_db
def test_cascade_delete_clears_plan_rows(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    TripStop.objects.create(
        trip=trip,
        kind=StopKind.PICKUP,
        sequence=0,
        polyline_index=1,
        lat=Decimal("38.303200"),
        lon=Decimal("-77.460500"),
        label="",
        scheduled_at=datetime(2030, 1, 15, 13, 0, tzinfo=UTC),
        duration_s=3600,
    )
    LogEvent.objects.create(
        trip=trip,
        sequence=0,
        status=DutyStatusChoices.DRIVING,
        start=datetime(2030, 1, 15, 13, 0, tzinfo=UTC),
        duration_s=3600,
        location="37.5407, -77.4360",
        note="",
    )
    LogDay.objects.create(
        trip=trip,
        date=datetime(2030, 1, 15, tzinfo=UTC).date(),
        off_duty_s=0,
        sleeper_s=0,
        driving_s=3600,
        on_duty_not_driving_s=0,
        total_miles=Decimal("55.0"),
    )

    trip.delete()

    assert Trip.objects.count() == 0
    assert TripStop.objects.count() == 0
    assert LogEvent.objects.count() == 0
    assert LogDay.objects.count() == 0


@pytest.mark.django_db
def test_trip_stops_reverse_relation_name(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    TripStop.objects.create(
        trip=trip,
        kind=StopKind.PICKUP,
        sequence=0,
        polyline_index=1,
        lat=Decimal("38.303200"),
        lon=Decimal("-77.460500"),
        label="",
        scheduled_at=datetime(2030, 1, 15, 13, 0, tzinfo=UTC),
        duration_s=3600,
    )
    assert trip.stops.count() == 1


@pytest.mark.django_db
def test_log_events_reverse_relation_name(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    LogEvent.objects.create(
        trip=trip,
        sequence=0,
        status=DutyStatusChoices.DRIVING,
        start=datetime(2030, 1, 15, 13, 0, tzinfo=UTC),
        duration_s=3600,
        location="37.5407, -77.4360",
        note="",
    )
    assert trip.log_events.count() == 1


@pytest.mark.django_db
def test_log_days_reverse_relation_name(trip_factory: type[TripFactory]) -> None:
    trip = trip_factory.create()
    LogDay.objects.create(
        trip=trip,
        date=datetime(2030, 1, 15, tzinfo=UTC).date(),
        off_duty_s=0,
        sleeper_s=0,
        driving_s=3600,
        on_duty_not_driving_s=0,
        total_miles=Decimal("55.0"),
    )
    assert trip.log_days.count() == 1
