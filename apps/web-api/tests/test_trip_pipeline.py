"""Unit tests for ``services.plan_trip`` (spec 04).

We mock ``directions_hgv`` at the boundary so the pipeline exercises its own
control flow (status transitions, cache writes, cache hits, error mapping)
without touching the network.
"""

from __future__ import annotations

from dataclasses import asdict
from decimal import Decimal
from typing import Any
from unittest.mock import patch

import pytest

from web_api.apps.trips.models import Trip, TripRouteCache, TripStatus
from web_api.apps.trips.services import plan_trip
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
)

TEST_USER_ID = "user_pipeline_456"

_VALID_INPUT: dict[str, Any] = {
    "current": {"label": "Richmond, VA", "lat": 37.5407, "lon": -77.4360, "confidence": 0.95},
    "pickup": {"label": "Fredericksburg, VA", "lat": 38.3032, "lon": -77.4605, "confidence": 0.95},
    "dropoff": {"label": "Newark, NJ", "lat": 40.7357, "lon": -74.1724, "confidence": 0.95},
    "cycle_hours_used": Decimal("35.0"),
}


def _result(distance_mi: float = 342.7, duration_s: int = 19080) -> DirectionsResult:
    return DirectionsResult(
        polyline=[[-77.4360, 37.5407], [-77.4605, 38.3032], [-74.1724, 40.7357]],
        summary=DirectionsSummary(distance_mi=distance_mi, duration_s=duration_s),
        segments=[
            DirectionsSegment(distance_mi=67.4, duration_s=4321, from_index=0, to_index=1),
            DirectionsSegment(distance_mi=275.3, duration_s=14760, from_index=1, to_index=2),
        ],
    )


@pytest.mark.django_db
def test_success_transitions_to_planned_and_writes_cache() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ) as mock_directions:
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    mock_directions.assert_called_once()
    assert trip.status == TripStatus.PLANNED
    assert trip.route_polyline == [[-77.4360, 37.5407], [-77.4605, 38.3032], [-74.1724, 40.7357]]
    assert trip.route_summary == {"distance_mi": 342.7, "duration_s": 19080}
    assert trip.route_segments is not None
    assert len(trip.route_segments) == 2
    assert trip.route_segments[0]["from_index"] == 0
    assert trip.route_error_code is None
    assert TripRouteCache.objects.count() == 1


@pytest.mark.django_db
def test_cache_hit_skips_ors_call() -> None:
    # Seed cache with the same canonical input.
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert TripRouteCache.objects.count() == 1

    with patch("web_api.apps.trips.services.directions_hgv") as mock_directions:
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    mock_directions.assert_not_called()
    assert trip.status == TripStatus.PLANNED
    assert trip.route_polyline is not None
    assert TripRouteCache.objects.count() == 1  # no duplicate row


@pytest.mark.django_db
def test_cache_miss_creates_row() -> None:
    assert TripRouteCache.objects.count() == 0
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert TripRouteCache.objects.count() == 1
    cached = TripRouteCache.objects.get()
    assert cached.payload["summary"]["distance_mi"] == 342.7
    assert "v1|driving-hgv|recommended|mi|" in cached.coords_canonical


@pytest.mark.django_db
def test_rate_limit_per_minute_marks_failed() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsRateLimitError("per minute", window="per-minute"),
    ):
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    assert trip.status == TripStatus.FAILED
    assert trip.route_error_code == "rate_limit_per_minute"
    assert trip.route_polyline is None
    assert TripRouteCache.objects.count() == 0


@pytest.mark.django_db
def test_rate_limit_daily_marks_failed_with_distinct_code() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsRateLimitError("daily", window="daily"),
    ):
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    assert trip.status == TripStatus.FAILED
    assert trip.route_error_code == "rate_limit_daily"


@pytest.mark.django_db
def test_upstream_error_marks_failed_upstream() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsUpstreamError("boom"),
    ):
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    assert trip.status == TripStatus.FAILED
    assert trip.route_error_code == "upstream"


@pytest.mark.django_db
def test_request_error_marks_failed_validation() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsRequestError("400"),
    ):
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    assert trip.status == TripStatus.FAILED
    assert trip.route_error_code == "validation"


@pytest.mark.django_db
def test_failed_trip_is_still_persisted_and_findable() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        side_effect=OrsUpstreamError("boom"),
    ):
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    refetched = Trip.objects.get(pk=trip.pk)
    assert refetched.status == TripStatus.FAILED
    assert refetched.user_id == TEST_USER_ID


@pytest.mark.django_db
def test_cached_payload_round_trips_into_dataclass() -> None:
    # Manually seed a cache row, then confirm a second plan_trip reads it
    # back into DirectionsResult-shaped Trip fields.
    canonical_seed = _result()
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=canonical_seed,
    ):
        first = plan_trip(_VALID_INPUT, TEST_USER_ID)

    with patch("web_api.apps.trips.services.directions_hgv") as mock_directions:
        second = plan_trip(_VALID_INPUT, TEST_USER_ID)

    mock_directions.assert_not_called()
    assert first.route_summary == second.route_summary
    assert first.route_polyline == second.route_polyline
    assert second.route_segments is not None
    assert [s["from_index"] for s in second.route_segments] == [0, 1]
    # Re-stringified to confirm the payload contains the raw asdict() shape.
    assert TripRouteCache.objects.get().payload == asdict(canonical_seed)
