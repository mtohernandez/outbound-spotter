"""Unit tests for the ORS Pelias client.

We mock ``requests.get`` at the boundary so the tests exercise URL building,
header injection, parameter clamping, response parsing, and error mapping
without ever touching the network.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from django.test import override_settings
from pydantic import SecretStr
import pytest
import requests

from web_api.integrations.openrouteservice import (
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
    geocode_autocomplete,
    geocode_search,
)


def _fake_response(status_code: int = 200, json_body: dict[str, Any] | None = None) -> MagicMock:
    response = MagicMock(spec=requests.Response)
    response.status_code = status_code
    response.ok = 200 <= status_code < 300
    response.json.return_value = json_body or {"features": []}
    return response


def _fake_feature(
    label: str = "Richmond, VA",
    lon: float = -77.4360,
    lat: float = 37.5407,
) -> dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "label": label,
            "country_a": "USA",
            "region_a": "VA",
            "locality": "Richmond",
            "confidence": 0.93,
            "match_type": "exact",
        },
    }


@override_settings(
    OPENROUTESERVICE_API_KEY=SecretStr("test-key"),
    OPENROUTESERVICE_BASE_URL="https://api.openrouteservice.org",
)
def test_autocomplete_sends_authorization_header_and_us_boundary() -> None:
    with patch(
        "web_api.integrations.openrouteservice._session.get",
        return_value=_fake_response(json_body={"features": [_fake_feature()]}),
    ) as mock_get:
        result = geocode_autocomplete("Richmond")

    assert len(result) == 1
    assert result[0].label == "Richmond, VA"
    assert result[0].lat == pytest.approx(37.5407)
    assert result[0].lon == pytest.approx(-77.4360)
    assert result[0].confidence == pytest.approx(0.93)

    mock_get.assert_called_once()
    call_kwargs = mock_get.call_args.kwargs
    assert mock_get.call_args.args[0] == "https://api.openrouteservice.org/geocode/autocomplete"
    assert call_kwargs["headers"]["Authorization"] == "test-key"
    assert call_kwargs["params"]["boundary.country"] == "US"
    assert call_kwargs["params"]["text"] == "Richmond"
    assert call_kwargs["timeout"] == 5.0


@override_settings(
    OPENROUTESERVICE_API_KEY=SecretStr("test-key"),
    OPENROUTESERVICE_BASE_URL="https://api.openrouteservice.org",
)
def test_autocomplete_clamps_size_to_max() -> None:
    with patch(
        "web_api.integrations.openrouteservice._session.get",
        return_value=_fake_response(),
    ) as mock_get:
        geocode_autocomplete("Richmond", size=999)

    assert mock_get.call_args.kwargs["params"]["size"] == 10


@override_settings(
    OPENROUTESERVICE_API_KEY=SecretStr("test-key"),
    OPENROUTESERVICE_BASE_URL="https://api.openrouteservice.org",
)
def test_autocomplete_clamps_size_to_min() -> None:
    with patch(
        "web_api.integrations.openrouteservice._session.get",
        return_value=_fake_response(),
    ) as mock_get:
        geocode_autocomplete("Richmond", size=0)

    assert mock_get.call_args.kwargs["params"]["size"] == 1


@override_settings(
    OPENROUTESERVICE_API_KEY=SecretStr("test-key"),
    OPENROUTESERVICE_BASE_URL="https://api.openrouteservice.org",
)
def test_autocomplete_passes_focus_point() -> None:
    with patch(
        "web_api.integrations.openrouteservice._session.get",
        return_value=_fake_response(),
    ) as mock_get:
        geocode_autocomplete("Richmond", focus=(37.5407, -77.4360))

    params = mock_get.call_args.kwargs["params"]
    assert params["focus.point.lat"] == pytest.approx(37.5407)
    assert params["focus.point.lon"] == pytest.approx(-77.4360)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_search_uses_search_path() -> None:
    with patch(
        "web_api.integrations.openrouteservice._session.get",
        return_value=_fake_response(json_body={"features": [_fake_feature()]}),
    ) as mock_get:
        geocode_search("Richmond, VA")

    assert mock_get.call_args.args[0].endswith("/geocode/search")


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_429_raises_rate_limit_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.get",
            return_value=_fake_response(status_code=429),
        ),
        pytest.raises(OrsRateLimitError),
    ):
        geocode_autocomplete("Richmond")


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_400_raises_request_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.get",
            return_value=_fake_response(status_code=400),
        ),
        pytest.raises(OrsRequestError),
    ):
        geocode_autocomplete("Richmond")


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_500_raises_upstream_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.get",
            return_value=_fake_response(status_code=503),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        geocode_autocomplete("Richmond")


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_transport_error_raises_upstream_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.get",
            side_effect=requests.ConnectionError("nope"),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        geocode_autocomplete("Richmond")


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_malformed_feature_raises_upstream_error() -> None:
    bad_feature: dict[str, Any] = {
        "type": "Feature",
        "geometry": {"coordinates": []},  # too few coords
        "properties": {"label": "X"},
    }
    with (
        patch(
            "web_api.integrations.openrouteservice._session.get",
            return_value=_fake_response(json_body={"features": [bad_feature]}),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        geocode_autocomplete("Richmond")
