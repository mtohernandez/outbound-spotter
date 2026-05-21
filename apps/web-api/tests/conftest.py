"""Pytest configuration + shared fixtures.

Pytest-django picks up ``DJANGO_SETTINGS_MODULE`` from pyproject.toml. The
fixtures below give DB-touching tests a stable Clerk-authenticated APIClient
and factories that round-trip through the Trip ORM (Trip + the spec-06 plan
tables: TripStop / LogEvent / LogDay).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar
from unittest.mock import patch

from clerk_backend_api.security import AuthStatus, RequestState
import factory
from factory.declarations import Sequence, SubFactory
import pytest
from rest_framework.test import APIClient

from web_api.apps.trips.models import DutyStatusChoices, LogDay, LogEvent, StopKind, Trip, TripStop

if TYPE_CHECKING:
    from collections.abc import Iterator


TEST_USER_ID = "user_test_123"

# Far-future fixed datetime so the start_at validator never rejects a factory
# instance for being in the past. Used by ``TripFactory`` and by the create-
# endpoint tests that POST JSON payloads.
TEST_START_AT_ISO = "2030-01-15T08:00:00-05:00"
TEST_START_AT = datetime(2030, 1, 15, 13, 0, 0, tzinfo=UTC)  # 08:00 EST


class TripFactory(factory.django.DjangoModelFactory[Trip]):
    class Meta:
        model = Trip

    user_id = TEST_USER_ID
    current_label = "Richmond, VA"
    current_lat = 37.5407
    current_lon = -77.4360
    pickup_label = "Fredericksburg, VA"
    pickup_lat = 38.3032
    pickup_lon = -77.4605
    dropoff_label = "Newark, NJ"
    dropoff_lat = 40.7357
    dropoff_lon = -74.1724
    cycle_hours_used = Decimal("0.0")
    start_at = TEST_START_AT
    # Stored values shared across factory instances are immutable from the
    # tests' perspective (no mutation in the suite); cheap and avoids the
    # untyped `factory.LazyFunction` shim.
    route_polyline: ClassVar[list[list[float]]] = [
        [-77.4360, 37.5407],
        [-77.4605, 38.3032],
        [-74.1724, 40.7357],
    ]
    route_segments: ClassVar[list[dict[str, float | int]]] = [
        {"distance_mi": 67.4, "duration_s": 4321, "from_index": 0, "to_index": 1},
        {"distance_mi": 275.3, "duration_s": 14760, "from_index": 1, "to_index": 2},
    ]
    route_summary: ClassVar[dict[str, float | int]] = {"distance_mi": 342.7, "duration_s": 19080}


class TripStopFactory(factory.django.DjangoModelFactory[TripStop]):
    """One ``TripStop`` per call. ``sequence`` increments globally so multiple
    instances on the same Trip stay unique on ``(trip, sequence)``.
    """

    class Meta:
        model = TripStop

    trip = SubFactory(TripFactory)  # type: ignore[no-untyped-call]
    kind = StopKind.PICKUP
    sequence = Sequence(int)  # type: ignore[no-untyped-call]
    polyline_index = 1
    lat = Decimal("38.303200")
    lon = Decimal("-77.460500")
    label = ""
    scheduled_at = TEST_START_AT
    duration_s = 3600


class LogEventFactory(factory.django.DjangoModelFactory[LogEvent]):
    class Meta:
        model = LogEvent

    trip = SubFactory(TripFactory)  # type: ignore[no-untyped-call]
    sequence = Sequence(int)  # type: ignore[no-untyped-call]
    status = DutyStatusChoices.DRIVING
    start = TEST_START_AT
    duration_s = 3600
    location = "Richmond, VA"
    note = ""


class LogDayFactory(factory.django.DjangoModelFactory[LogDay]):
    """``date`` advances per-factory-call so ``(trip, date)`` stays unique
    across batches on the same Trip without per-test arithmetic.
    """

    class Meta:
        model = LogDay

    trip = SubFactory(TripFactory)  # type: ignore[no-untyped-call]
    date = Sequence(lambda n: date(2030, 1, 15) + timedelta(days=n))  # type: ignore[no-untyped-call]
    off_duty_s = 0
    sleeper_s = 0
    driving_s = 3600
    on_duty_not_driving_s = 3600
    total_miles = Decimal("55.0")


@pytest.fixture
def trip_factory() -> type[TripFactory]:
    return TripFactory


@pytest.fixture
def trip_stop_factory() -> type[TripStopFactory]:
    return TripStopFactory


@pytest.fixture
def log_event_factory() -> type[LogEventFactory]:
    return LogEventFactory


@pytest.fixture
def log_day_factory() -> type[LogDayFactory]:
    return LogDayFactory


@pytest.fixture
def authenticated_client() -> Iterator[APIClient]:
    """An APIClient whose Bearer token is verified by a patched Clerk SDK."""
    fake_state = RequestState(
        status=AuthStatus.SIGNED_IN,
        token="goodtoken",
        payload={"sub": TEST_USER_ID, "sid": "sess_test", "email": "test@example.com"},
    )
    with patch("web_api.auth.authentication.authenticate_request", return_value=fake_state):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer goodtoken")
        yield client


@pytest.fixture
def unauthenticated_client() -> APIClient:
    """An APIClient with no Authorization header — exercises the 401 path."""
    return APIClient()
