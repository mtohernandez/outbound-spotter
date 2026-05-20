"""Pytest configuration + shared fixtures.

Pytest-django picks up ``DJANGO_SETTINGS_MODULE`` from pyproject.toml. The
fixtures below give DB-touching tests a stable Clerk-authenticated APIClient
and a ``TripFactory`` that round-trips through the ``Trip`` ORM.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar
from unittest.mock import patch

from clerk_backend_api.security import AuthStatus, RequestState
import factory
import pytest
from rest_framework.test import APIClient

from web_api.apps.trips.models import Trip

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


@pytest.fixture
def trip_factory() -> type[TripFactory]:
    return TripFactory


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
