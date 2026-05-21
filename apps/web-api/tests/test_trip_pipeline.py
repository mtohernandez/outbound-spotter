"""Unit tests for ``services.plan_trip``.

We mock ``directions_hgv`` AND ``hos_adapter.materialize_plan`` at the
boundary so the pipeline exercises its own control flow (cache hits /
misses, atomic insert on success, NO row on failure) without touching the
network or running the planner. Planner correctness has dedicated tests
under ``tests/hos/`` and ``tests/test_hos_adapter.py``.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

from web_api.apps.trips.models import Trip, TripRouteCache
from web_api.apps.trips.services import plan_trip
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
)

if TYPE_CHECKING:
    from collections.abc import Iterator

TEST_USER_ID = "user_pipeline_456"

_FUTURE_START_AT = datetime(2030, 1, 15, 13, 0, 0, tzinfo=UTC)

_VALID_INPUT: dict[str, Any] = {
    "current": {"label": "Richmond, VA", "lat": 37.5407, "lon": -77.4360, "confidence": 0.95},
    "pickup": {"label": "Fredericksburg, VA", "lat": 38.3032, "lon": -77.4605, "confidence": 0.95},
    "dropoff": {"label": "Newark, NJ", "lat": 40.7357, "lon": -74.1724, "confidence": 0.95},
    "cycle_hours_used": Decimal("35.0"),
    "start_at": _FUTURE_START_AT,
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


@pytest.fixture(autouse=True)
def _stub_materialize_plan() -> Iterator[MagicMock]:
    """Pipeline tests skip the planner; correctness is exercised in
    ``tests/test_hos_adapter.py`` and ``tests/hos/`` with realistic polylines.

    Individual tests can re-patch ``hos_adapter.materialize_plan`` (e.g., the
    rollback test below) — the inner ``with`` shadows this autouse mock for
    the duration of the test body.
    """
    with patch("web_api.apps.trips.services.hos_adapter.materialize_plan") as m:
        yield m


@pytest.mark.django_db
def test_success_persists_trip_and_writes_cache() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ) as mock_directions:
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    mock_directions.assert_called_once()
    assert trip.route_polyline == [[-77.4360, 37.5407], [-77.4605, 38.3032], [-74.1724, 40.7357]]
    assert trip.route_summary == {"distance_mi": 342.7, "duration_s": 19080}
    assert trip.route_segments is not None
    assert len(trip.route_segments) == 2
    assert TripRouteCache.objects.count() == 1


@pytest.mark.django_db
def test_cache_hit_skips_ors_call_and_persists_trip() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert TripRouteCache.objects.count() == 1
    assert Trip.objects.count() == 1

    with patch("web_api.apps.trips.services.directions_hgv") as mock_directions:
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    mock_directions.assert_not_called()
    assert trip.route_polyline is not None
    assert TripRouteCache.objects.count() == 1
    assert Trip.objects.count() == 2


@pytest.mark.django_db
def test_rate_limit_per_minute_raises_and_does_not_persist() -> None:
    with (
        patch(
            "web_api.apps.trips.services.directions_hgv",
            side_effect=OrsRateLimitError("per minute", window="per-minute"),
        ),
        pytest.raises(OrsRateLimitError) as excinfo,
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert excinfo.value.window == "per-minute"
    assert Trip.objects.count() == 0
    assert TripRouteCache.objects.count() == 0


@pytest.mark.django_db
def test_rate_limit_daily_raises_and_does_not_persist() -> None:
    with (
        patch(
            "web_api.apps.trips.services.directions_hgv",
            side_effect=OrsRateLimitError("daily", window="daily"),
        ),
        pytest.raises(OrsRateLimitError) as excinfo,
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert excinfo.value.window == "daily"
    assert Trip.objects.count() == 0


@pytest.mark.django_db
def test_upstream_error_raises_and_does_not_persist() -> None:
    with (
        patch(
            "web_api.apps.trips.services.directions_hgv",
            side_effect=OrsUpstreamError("boom"),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert Trip.objects.count() == 0


@pytest.mark.django_db
def test_request_error_raises_and_does_not_persist() -> None:
    with (
        patch(
            "web_api.apps.trips.services.directions_hgv",
            side_effect=OrsRequestError("400"),
        ),
        pytest.raises(OrsRequestError),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    assert Trip.objects.count() == 0
    assert TripRouteCache.objects.count() == 0


@pytest.mark.django_db
def test_cached_payload_round_trips_into_dataclass() -> None:
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
    assert TripRouteCache.objects.get().payload == asdict(canonical_seed)


@pytest.mark.django_db
def test_canonical_cache_key_uses_versioned_prefix() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)
    cached = TripRouteCache.objects.get()
    assert cached.coords_canonical.startswith("v1|driving-hgv|recommended|mi|")


@pytest.mark.django_db
def test_start_at_round_trips_through_plan_trip() -> None:
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_result(),
    ):
        trip = plan_trip(_VALID_INPUT, TEST_USER_ID)

    assert trip.start_at == _FUTURE_START_AT


@pytest.mark.django_db
def test_atomic_rollback_when_materialize_plan_raises() -> None:
    """Adapter raise → Trip insert AND any plan rows rolled back."""
    from web_api.apps.trips.models import LogDay, LogEvent, TripStop  # noqa: PLC0415

    with (
        patch("web_api.apps.trips.services.directions_hgv", return_value=_result()),
        patch(
            "web_api.apps.trips.services.hos_adapter.materialize_plan",
            side_effect=ValueError("planner refused"),
        ),
        pytest.raises(ValueError, match="planner refused"),
    ):
        plan_trip(_VALID_INPUT, TEST_USER_ID)

    assert Trip.objects.count() == 0
    assert TripStop.objects.count() == 0
    assert LogEvent.objects.count() == 0
    assert LogDay.objects.count() == 0


@pytest.mark.django_db
def test_start_at_validator_reads_fresh_now_per_request() -> None:
    """The callable validator must re-read ``timezone.now()`` on each call.

    Architect-review M1: a frozen ``MinValueValidator(now - …)`` would have
    been evaluated at class-definition time and would grant an indefinite
    grace window as the worker keeps running. We patch ``timezone.now`` and
    confirm a payload that was valid at boot becomes invalid after the clock
    advances.
    """
    from datetime import datetime as _dt  # noqa: PLC0415

    from django.utils import timezone as django_timezone  # noqa: PLC0415

    from web_api.apps.trips.serializers import (  # noqa: PLC0415
        TripCreateRequestSerializer,
    )

    payload = {
        "current": _VALID_INPUT["current"],
        "pickup": _VALID_INPUT["pickup"],
        "dropoff": _VALID_INPUT["dropoff"],
        "cycle_hours_used": "35.0",
        "start_at": "2030-01-15T08:00:00-05:00",
    }
    boot_time = _dt(2030, 1, 15, 12, 0, 0, tzinfo=UTC)  # before start
    advanced_time = _dt(2030, 1, 16, 0, 0, 0, tzinfo=UTC)  # after start + slack

    with patch.object(django_timezone, "now", return_value=boot_time):
        serializer_at_boot = TripCreateRequestSerializer(data=payload)
        assert serializer_at_boot.is_valid(), serializer_at_boot.errors

    with patch.object(django_timezone, "now", return_value=advanced_time):
        serializer_advanced = TripCreateRequestSerializer(data=payload)
        assert not serializer_advanced.is_valid()
        assert "start_at" in serializer_advanced.errors


@pytest.mark.django_db
def test_serializer_accepts_iso_8601_with_offset() -> None:
    """The wire form is ISO 8601 with offset (matches FE ``z.string().datetime({offset:true})``)."""
    from web_api.apps.trips.serializers import (  # noqa: PLC0415
        TripCreateRequestSerializer,
    )

    payload = {
        "current": _VALID_INPUT["current"],
        "pickup": _VALID_INPUT["pickup"],
        "dropoff": _VALID_INPUT["dropoff"],
        "cycle_hours_used": "35.0",
        "start_at": "2030-01-15T08:00:00-05:00",
    }
    fixed_now = datetime(2030, 1, 15, 12, 0, 0, tzinfo=UTC)
    from django.utils import timezone as django_timezone  # noqa: PLC0415

    with patch.object(django_timezone, "now", return_value=fixed_now):
        serializer = TripCreateRequestSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors
        # 08:00 -05:00 == 13:00 UTC
        parsed = serializer.validated_data["start_at"]
    assert parsed == datetime(2030, 1, 15, 13, 0, 0, tzinfo=UTC)
