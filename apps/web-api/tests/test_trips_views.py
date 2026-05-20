"""DRF tests for the stub Trip endpoints.

The Trip model is exercised against the SQLite test DB. Ownership is the
load-bearing rule under test — only the request's ``user_id`` can read its own
trips.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid

import pytest

if TYPE_CHECKING:
    from rest_framework.test import APIClient

    from tests.conftest import TripFactory


VALID_PAYLOAD: dict[str, object] = {
    "current": {"label": "Richmond, VA", "lat": 37.5407, "lon": -77.4360, "confidence": 0.93},
    "pickup": {"label": "Fredericksburg, VA", "lat": 38.3032, "lon": -77.4605, "confidence": 0.91},
    "dropoff": {"label": "Newark, NJ", "lat": 40.7357, "lon": -74.1724, "confidence": 0.94},
    "cycle_hours_used": "35.0",
}


def test_create_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 401


def test_retrieve_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.get(f"/api/trips/{uuid.uuid4()}/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_create_persists_trip_and_returns_201(authenticated_client: APIClient) -> None:
    response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["current_label"] == "Richmond, VA"
    assert body["pickup_label"] == "Fredericksburg, VA"
    assert body["dropoff_label"] == "Newark, NJ"
    assert body["cycle_hours_used"] == "35.0"
    assert uuid.UUID(body["id"]).version == 4


@pytest.mark.django_db
def test_create_stamps_user_id_from_request(authenticated_client: APIClient) -> None:
    from tests.conftest import TEST_USER_ID  # noqa: PLC0415
    from web_api.apps.trips.models import Trip  # noqa: PLC0415

    response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 201
    persisted = Trip.objects.get(pk=response.json()["id"])
    assert persisted.user_id == TEST_USER_ID


@pytest.mark.django_db
def test_create_rejects_invalid_cycle_hours(authenticated_client: APIClient) -> None:
    payload = {**VALID_PAYLOAD, "cycle_hours_used": "75.5"}

    response = authenticated_client.post("/api/trips/", payload, format="json")

    assert response.status_code == 400
    assert response.json()["errors"] is not None


@pytest.mark.django_db
def test_create_rejects_missing_address(authenticated_client: APIClient) -> None:
    payload = {**VALID_PAYLOAD}
    del payload["pickup"]

    response = authenticated_client.post("/api/trips/", payload, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_rejects_out_of_range_lat(authenticated_client: APIClient) -> None:
    payload = {
        **VALID_PAYLOAD,
        "current": {**VALID_PAYLOAD["current"], "lat": 200.0},  # type: ignore[dict-item]
    }

    response = authenticated_client.post("/api/trips/", payload, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_retrieve_returns_200_for_owner(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    trip = trip_factory.create()

    response = authenticated_client.get(f"/api/trips/{trip.id}/")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(trip.id)
    assert body["current_label"] == "Richmond, VA"


@pytest.mark.django_db
def test_retrieve_returns_403_for_other_user(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    other = trip_factory.create(user_id="user_someone_else")

    response = authenticated_client.get(f"/api/trips/{other.id}/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_retrieve_returns_404_for_unknown_id(authenticated_client: APIClient) -> None:
    response = authenticated_client.get(f"/api/trips/{uuid.uuid4()}/")

    assert response.status_code == 404


def test_retrieve_invalid_uuid_is_404(authenticated_client: APIClient) -> None:
    response = authenticated_client.get("/api/trips/not-a-uuid/")

    assert response.status_code == 404
