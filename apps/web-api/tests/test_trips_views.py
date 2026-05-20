"""DRF tests for the Trip endpoints.

The Trip model is exercised against the SQLite test DB. Ownership is the
load-bearing rule under test — only the request's ``user_id`` can read its
own trips. ``TripCreateView`` runs the ``plan_trip`` pipeline (which calls
ORS), so tests mock ``directions_hgv`` at the boundary; ORS-error scenarios
expect HTTP error envelopes (no Trip row created).
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch
import uuid

import pytest

from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
)

if TYPE_CHECKING:
    from rest_framework.test import APIClient

    from tests.conftest import TripFactory


def _ors_result() -> DirectionsResult:
    return DirectionsResult(
        polyline=[[-77.4360, 37.5407], [-77.4605, 38.3032], [-74.1724, 40.7357]],
        summary=DirectionsSummary(distance_mi=342.7, duration_s=19080),
        segments=[
            DirectionsSegment(distance_mi=67.4, duration_s=4321, from_index=0, to_index=1),
            DirectionsSegment(distance_mi=275.3, duration_s=14760, from_index=1, to_index=2),
        ],
    )


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
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_ors_result(),
    ):
        response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 201
    body = response.json()
    assert "status" not in body
    assert body["current_label"] == "Richmond, VA"
    assert body["pickup_label"] == "Fredericksburg, VA"
    assert body["dropoff_label"] == "Newark, NJ"
    assert body["cycle_hours_used"] == "35.0"
    assert uuid.UUID(body["id"]).version == 4
    assert body["route_polyline"] == [
        [-77.4360, 37.5407],
        [-77.4605, 38.3032],
        [-74.1724, 40.7357],
    ]
    assert body["route_summary"] == {"distance_mi": 342.7, "duration_s": 19080}
    assert len(body["route_segments"]) == 2


@pytest.mark.django_db
def test_create_returns_400_on_ors_request_error_with_no_row(
    authenticated_client: APIClient,
) -> None:
    from web_api.apps.trips.models import Trip  # noqa: PLC0415

    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsRequestError("400"),
    ):
        response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 400
    body = response.json()
    assert body["errors"] is None
    assert "Couldn't plan this route" in body["detail"]
    assert Trip.objects.count() == 0


@pytest.mark.django_db
def test_create_returns_429_on_ors_rate_limit_per_minute(
    authenticated_client: APIClient,
) -> None:
    from web_api.apps.trips.models import Trip  # noqa: PLC0415

    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsRateLimitError("per minute", window="per-minute"),
    ):
        response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 429
    body = response.json()
    assert "per-minute" in body["detail"]
    assert Trip.objects.count() == 0


@pytest.mark.django_db
def test_create_returns_429_on_ors_rate_limit_daily(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsRateLimitError("daily", window="daily"),
    ):
        response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 429
    body = response.json()
    assert "Daily routing quota exhausted" in body["detail"]


@pytest.mark.django_db
def test_create_returns_502_on_ors_upstream_error(authenticated_client: APIClient) -> None:
    from web_api.apps.trips.models import Trip  # noqa: PLC0415

    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsUpstreamError("boom"),
    ):
        response = authenticated_client.post("/api/trips/", VALID_PAYLOAD, format="json")

    assert response.status_code == 502
    body = response.json()
    assert "Couldn't reach the routing service" in body["detail"]
    assert Trip.objects.count() == 0


@pytest.mark.django_db
def test_create_stamps_user_id_from_request(authenticated_client: APIClient) -> None:
    from tests.conftest import TEST_USER_ID  # noqa: PLC0415
    from web_api.apps.trips.models import Trip  # noqa: PLC0415

    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_ors_result(),
    ):
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
    assert body["route_summary"] == {"distance_mi": 342.7, "duration_s": 19080}
    assert body["route_segments"][0]["from_index"] == 0


@pytest.mark.django_db
def test_retrieve_returns_404_for_other_users_trip(
    authenticated_client: APIClient,
    trip_factory: type[TripFactory],
) -> None:
    other = trip_factory.create(user_id="user_someone_else")

    response = authenticated_client.get(f"/api/trips/{other.id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_retrieve_returns_404_for_unknown_id(authenticated_client: APIClient) -> None:
    response = authenticated_client.get(f"/api/trips/{uuid.uuid4()}/")

    assert response.status_code == 404


def test_retrieve_invalid_uuid_is_404(authenticated_client: APIClient) -> None:
    response = authenticated_client.get("/api/trips/not-a-uuid/")

    assert response.status_code == 404
