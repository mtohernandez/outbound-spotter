"""DRF tests for the Pelias proxy views.

Auth is patched via the ``authenticated_client`` fixture; the ORS client is
patched at the function name imported into ``views.py`` so we never touch the
real upstream.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from web_api.integrations.openrouteservice import (
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
    PeliasFeature,
)

if TYPE_CHECKING:
    from rest_framework.test import APIClient


def _feature(label: str = "Richmond, VA") -> PeliasFeature:
    return PeliasFeature(
        label=label,
        country_a="USA",
        region_a="VA",
        locality="Richmond",
        confidence=0.93,
        match_type="exact",
        lat=37.5407,
        lon=-77.4360,
    )


def test_autocomplete_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.get("/api/geocode/autocomplete/?text=Richmond")

    assert response.status_code == 401


def test_search_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.get("/api/geocode/search/?text=Richmond")

    assert response.status_code == 401


def test_autocomplete_happy_path(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_autocomplete",
        return_value=[_feature()],
    ) as mocked:
        response = authenticated_client.get("/api/geocode/autocomplete/?text=Richmond")

    assert response.status_code == 200
    body = response.json()
    assert "features" in body
    assert len(body["features"]) == 1
    assert body["features"][0]["label"] == "Richmond, VA"
    assert body["features"][0]["lat"] == pytest.approx(37.5407)
    mocked.assert_called_once()


def test_autocomplete_forwards_focus_point(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_autocomplete",
        return_value=[],
    ) as mocked:
        response = authenticated_client.get(
            "/api/geocode/autocomplete/?text=Richmond&focus_lat=37.5&focus_lon=-77.4",
        )

    assert response.status_code == 200
    _, kwargs = mocked.call_args
    assert kwargs["focus"] == pytest.approx((37.5, -77.4))


def test_autocomplete_empty_text_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.get("/api/geocode/autocomplete/?text=")

    assert response.status_code == 400
    body = response.json()
    assert "detail" in body
    assert body["errors"] is not None


def test_autocomplete_focus_half_missing_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.get(
        "/api/geocode/autocomplete/?text=Richmond&focus_lat=37.5",
    )

    assert response.status_code == 400


def test_autocomplete_rate_limit_returns_429(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_autocomplete",
        side_effect=OrsRateLimitError("quota", window="per-minute"),
    ):
        response = authenticated_client.get("/api/geocode/autocomplete/?text=Richmond")

    assert response.status_code == 429


def test_autocomplete_upstream_5xx_returns_502(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_autocomplete",
        side_effect=OrsUpstreamError("oops"),
    ):
        response = authenticated_client.get("/api/geocode/autocomplete/?text=Richmond")

    assert response.status_code == 502


def test_autocomplete_request_error_returns_400(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_autocomplete",
        side_effect=OrsRequestError("bad"),
    ):
        response = authenticated_client.get("/api/geocode/autocomplete/?text=Richmond")

    assert response.status_code == 400


def test_search_happy_path(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_search",
        return_value=[_feature("Newark, NJ")],
    ):
        response = authenticated_client.get("/api/geocode/search/?text=Newark")

    assert response.status_code == 200
    assert response.json()["features"][0]["label"] == "Newark, NJ"


def test_search_text_too_long_returns_400(authenticated_client: APIClient) -> None:
    over_long = "x" * 250
    response = authenticated_client.get(f"/api/geocode/search/?text={over_long}")

    assert response.status_code == 400


def test_reverse_without_token_returns_401(unauthenticated_client: APIClient) -> None:
    response = unauthenticated_client.post(
        "/api/geocode/reverse/",
        {"lat": 37.5, "lon": -77.4},
        format="json",
    )

    assert response.status_code == 401


def test_reverse_get_method_not_allowed(authenticated_client: APIClient) -> None:
    """Spec 11 follow-up MEDIUM-3: lat/lon are PII; GET would put them in
    access logs. The endpoint accepts POST only.
    """
    response = authenticated_client.get("/api/geocode/reverse/?lat=37.5&lon=-77.4")

    assert response.status_code == 405


def test_reverse_happy_path(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_reverse",
        return_value=[_feature()],
    ) as mocked:
        response = authenticated_client.post(
            "/api/geocode/reverse/",
            {"lat": 37.5407, "lon": -77.4360},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert body["features"][0]["label"] == "Richmond, VA"
    args, kwargs = mocked.call_args
    assert args[0] == pytest.approx(37.5407)
    assert args[1] == pytest.approx(-77.4360)
    assert kwargs.get("size", 1) == 1


def test_reverse_missing_lat_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.post(
        "/api/geocode/reverse/",
        {"lon": -77.4},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["errors"] is not None


def test_reverse_out_of_range_lat_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.post(
        "/api/geocode/reverse/",
        {"lat": 999, "lon": 0},
        format="json",
    )

    assert response.status_code == 400


def test_reverse_out_of_range_lon_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.post(
        "/api/geocode/reverse/",
        {"lat": 0, "lon": 999},
        format="json",
    )

    assert response.status_code == 400


def test_reverse_nan_lat_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.post(
        "/api/geocode/reverse/",
        {"lat": "nan", "lon": 0},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["errors"] is not None


def test_reverse_inf_lon_returns_400(authenticated_client: APIClient) -> None:
    response = authenticated_client.post(
        "/api/geocode/reverse/",
        {"lat": 0, "lon": "infinity"},
        format="json",
    )

    assert response.status_code == 400


def test_reverse_rate_limit_returns_429(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_reverse",
        side_effect=OrsRateLimitError("quota", window="per-minute"),
    ):
        response = authenticated_client.post(
            "/api/geocode/reverse/",
            {"lat": 37.5, "lon": -77.4},
            format="json",
        )

    assert response.status_code == 429


def test_reverse_upstream_5xx_returns_502(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_reverse",
        side_effect=OrsUpstreamError("oops"),
    ):
        response = authenticated_client.post(
            "/api/geocode/reverse/",
            {"lat": 37.5, "lon": -77.4},
            format="json",
        )

    assert response.status_code == 502


def test_reverse_request_error_returns_400(authenticated_client: APIClient) -> None:
    with patch(
        "web_api.apps.geocoding.views.geocode_reverse",
        side_effect=OrsRequestError("bad"),
    ):
        response = authenticated_client.post(
            "/api/geocode/reverse/",
            {"lat": 37.5, "lon": -77.4},
            format="json",
        )

    assert response.status_code == 400
