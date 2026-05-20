"""Pytest configuration + shared fixtures.

Pytest-django picks up ``DJANGO_SETTINGS_MODULE`` from pyproject.toml. The
fixtures below give DB-touching tests a stable Clerk-authenticated APIClient
and a ``TripFactory`` that round-trips through the ``Trip`` ORM.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from unittest.mock import patch

from clerk_backend_api.security import AuthStatus, RequestState
import factory
import pytest
from rest_framework.test import APIClient

from web_api.apps.trips.models import Trip

if TYPE_CHECKING:
    from collections.abc import Iterator


TEST_USER_ID = "user_test_123"


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
    status = "pending"


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
