"""DRF tests for ``TripRetrieveDestroyView`` DELETE branch (spec 09).

Ownership: 404 for foreign trips so the existence of a UUID isn't leakable
across users (no oracle — matches the spec-04 retrieve and spec-06 plan
view precedents). FK cascades verified directly against the plan tables.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch
import uuid

from django.core.cache import cache
import pytest

from web_api.apps.trips.models import LogDay, LogEvent, Trip, TripStop

if TYPE_CHECKING:
    from rest_framework.test import APIClient

    from tests.conftest import LogDayFactory, LogEventFactory, TripFactory, TripStopFactory


@pytest.fixture(autouse=True)
def _clear_throttle_cache() -> None:
    cache.clear()


def test_destroy_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.delete(f"/api/trips/{uuid.uuid4()}/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_destroy_returns_204_and_removes_row(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()

    response = authenticated_client.delete(f"/api/trips/{trip.id}/")

    assert response.status_code == 204
    assert response.content == b""
    assert not Trip.objects.filter(pk=trip.id).exists()


@pytest.mark.django_db
def test_destroy_cascades_to_stops_events_days(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
    trip_stop_factory: type[TripStopFactory],
    log_event_factory: type[LogEventFactory],
    log_day_factory: type[LogDayFactory],
) -> None:
    trip = trip_factory.create()
    trip_stop_factory.create(trip=trip)
    log_event_factory.create(trip=trip)
    log_day_factory.create(trip=trip)

    response = authenticated_client.delete(f"/api/trips/{trip.id}/")

    assert response.status_code == 204
    assert not Trip.objects.filter(pk=trip.id).exists()
    assert not TripStop.objects.filter(trip_id=trip.id).exists()
    assert not LogEvent.objects.filter(trip_id=trip.id).exists()
    assert not LogDay.objects.filter(trip_id=trip.id).exists()


@pytest.mark.django_db
def test_destroy_returns_404_for_foreign_trip(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """404 (not 403) so the existence of a UUID isn't leakable across users."""
    foreign = trip_factory.create(user_id="user_someone_else")

    response = authenticated_client.delete(f"/api/trips/{foreign.id}/")

    assert response.status_code == 404
    assert Trip.objects.filter(pk=foreign.id).exists()


@pytest.mark.django_db
def test_destroy_returns_404_for_unknown_id(authenticated_client: APIClient) -> None:
    response = authenticated_client.delete(f"/api/trips/{uuid.uuid4()}/")

    assert response.status_code == 404


def test_destroy_invalid_uuid_returns_404(authenticated_client: APIClient) -> None:
    response = authenticated_client.delete("/api/trips/not-a-uuid/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_destroy_throttle_enforces_per_user_limit(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    """Patch ``trip_delete`` rate down to 1/min and assert the 2nd DELETE is 429."""
    first_trip = trip_factory.create()
    second_trip = trip_factory.create()

    with patch(
        "rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES",
        new={"trip_delete": "1/min"},
    ):
        first = authenticated_client.delete(f"/api/trips/{first_trip.id}/")
        assert first.status_code == 204
        second = authenticated_client.delete(f"/api/trips/{second_trip.id}/")
    assert second.status_code == 429
