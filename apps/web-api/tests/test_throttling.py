"""DRF throttle tests (spec 04 decision 16).

DRF caches ``SimpleRateThrottle.THROTTLE_RATES`` at class load, so plain
``override_settings(REST_FRAMEWORK=...)`` does NOT flip the rate after first
import. We monkeypatch ``THROTTLE_RATES`` directly to plug in low test rates,
and rely on ``cache.clear()`` between tests so each one starts with an empty
throttle bucket. The production rates are smoke-asserted at the bottom.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

from clerk_backend_api.security import AuthStatus, RequestState
from django.conf import settings
from django.core.cache import cache
import pytest
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
)

if TYPE_CHECKING:
    from collections.abc import Iterator


_VALID_TRIP_PAYLOAD: dict[str, Any] = {
    "current": {"label": "Richmond, VA", "lat": 37.5407, "lon": -77.4360, "confidence": 0.93},
    "pickup": {"label": "Fredericksburg, VA", "lat": 38.3032, "lon": -77.4605, "confidence": 0.91},
    "dropoff": {"label": "Newark, NJ", "lat": 40.7357, "lon": -74.1724, "confidence": 0.94},
    "cycle_hours_used": "35.0",
    "start_at": "2030-01-15T08:00:00-05:00",
}


def _ors_result() -> DirectionsResult:
    return DirectionsResult(
        polyline=[[-77.4360, 37.5407], [-77.4605, 38.3032], [-74.1724, 40.7357]],
        summary=DirectionsSummary(distance_mi=342.7, duration_s=19080),
        segments=[
            DirectionsSegment(distance_mi=67.4, duration_s=4321, from_index=0, to_index=1),
            DirectionsSegment(distance_mi=275.3, duration_s=14760, from_index=1, to_index=2),
        ],
    )


def _client_for(user_id: str) -> Iterator[APIClient]:
    fake_state = RequestState(
        status=AuthStatus.SIGNED_IN,
        token="goodtoken",
        payload={"sub": user_id, "sid": "sess_test", "email": f"{user_id}@example.com"},
    )
    with patch("web_api.auth.authentication.authenticate_request", return_value=fake_state):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer goodtoken")
        yield client


@pytest.fixture(autouse=True)
def _clear_throttle_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _freeze_now_for_validator() -> Iterator[None]:
    """Pin ``timezone.now`` so the ``_validate_start_at_not_past`` cutoff
    sits before the test's ``start_at`` and trip-create POSTs succeed.
    """
    fixed_now = datetime(2030, 1, 14, 0, 0, 0, tzinfo=UTC)
    with patch("django.utils.timezone.now", return_value=fixed_now):
        yield


@pytest.fixture(autouse=True)
def _stub_materialize_plan() -> Iterator[None]:
    """Throttle tests don't exercise the planner — stub it so the trip-
    create path doesn't trip the fuel-stop polyline sanity check.
    """
    with patch("web_api.apps.trips.services.hos_adapter.materialize_plan"):
        yield


def _set_test_rates(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> None:
    base = {
        "geocode_autocomplete": "60/min",
        "geocode_search": "20/min",
        "trip_create": "30/hour",
    }
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {**base, **overrides})


@pytest.mark.django_db
def test_trip_create_returns_429_after_rate_exhausted(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_test_rates(monkeypatch, trip_create="3/min")
    client_iter = _client_for("user_throttle_a")
    client = next(client_iter)
    with patch(
        "web_api.apps.trips.services.directions_hgv",
        return_value=_ors_result(),
    ):
        for _ in range(3):
            r = client.post("/api/trips/", _VALID_TRIP_PAYLOAD, format="json")
            assert r.status_code == 201
        over = client.post("/api/trips/", _VALID_TRIP_PAYLOAD, format="json")
    assert over.status_code == 429
    body = over.json()
    assert "detail" in body
    assert body["errors"] is None
    next(client_iter, None)


def test_geocode_autocomplete_returns_429_after_rate_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_test_rates(monkeypatch, geocode_autocomplete="2/min")
    client_iter = _client_for("user_throttle_b")
    client = next(client_iter)
    with patch(
        "web_api.apps.geocoding.views.geocode_autocomplete",
        return_value=[],
    ):
        for _ in range(2):
            r = client.get("/api/geocode/autocomplete/?text=Richmond")
            assert r.status_code == 200
        over = client.get("/api/geocode/autocomplete/?text=Richmond")
    assert over.status_code == 429
    next(client_iter, None)


def test_geocode_search_returns_429_after_rate_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_test_rates(monkeypatch, geocode_search="2/min")
    client_iter = _client_for("user_throttle_c")
    client = next(client_iter)
    with patch(
        "web_api.apps.geocoding.views.geocode_search",
        return_value=[],
    ):
        for _ in range(2):
            r = client.get("/api/geocode/search/?text=Richmond")
            assert r.status_code == 200
        over = client.get("/api/geocode/search/?text=Richmond")
    assert over.status_code == 429
    next(client_iter, None)


def test_throttle_is_keyed_per_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_test_rates(monkeypatch, geocode_autocomplete="2/min")

    client_iter_a = _client_for("user_alice")
    client_a = next(client_iter_a)
    with patch("web_api.apps.geocoding.views.geocode_autocomplete", return_value=[]):
        for _ in range(2):
            assert client_a.get("/api/geocode/autocomplete/?text=A").status_code == 200
        assert client_a.get("/api/geocode/autocomplete/?text=A").status_code == 429
    next(client_iter_a, None)

    client_iter_b = _client_for("user_bob")
    client_b = next(client_iter_b)
    with patch("web_api.apps.geocoding.views.geocode_autocomplete", return_value=[]):
        assert client_b.get("/api/geocode/autocomplete/?text=B").status_code == 200
    next(client_iter_b, None)


def test_production_throttle_rates_are_intact() -> None:
    """Smoke: confirm the documented rates remain in settings (not the
    monkeypatched class attribute — the source of truth is REST_FRAMEWORK)."""
    from typing import cast  # noqa: PLC0415

    rest_framework = cast("dict[str, Any]", settings.REST_FRAMEWORK)
    rates = cast("dict[str, str]", rest_framework["DEFAULT_THROTTLE_RATES"])
    assert rates["geocode_autocomplete"] == "60/min"
    assert rates["geocode_search"] == "20/min"
    assert rates["trip_create"] == "30/hour"
