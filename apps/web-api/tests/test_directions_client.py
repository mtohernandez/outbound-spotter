"""Unit tests for the ORS Directions client (spec 04).

We mock ``_session.post`` at the boundary so the tests exercise URL building,
header injection, body shape, response parsing, and the error-code mapping
from spec 04 decision 7. No network is touched.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from django.test import override_settings
from pydantic import SecretStr
import pytest
import requests

from web_api.integrations.openrouteservice import (
    DirectionsResult,
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
    directions_hgv,
)

_BASE_URL = "https://api.openrouteservice.org"
_DIRECTIONS_PATH = "/v2/directions/driving-hgv/geojson"
_COORDS: list[tuple[float, float]] = [
    (-77.4360, 37.5407),
    (-77.4605, 38.3032),
    (-74.1724, 40.7357),
]


def _fake_directions_body() -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-77.4360, 37.5407],
                        [-77.4605, 38.3032],
                        [-74.1724, 40.7357],
                    ],
                },
                "properties": {
                    "summary": {"distance": 342.7, "duration": 19080.4},
                    "segments": [
                        {"distance": 67.4, "duration": 4320.6},
                        {"distance": 275.3, "duration": 14760.0},
                    ],
                    "way_points": [0, 1, 2],
                },
            },
        ],
    }


def _fake_response(
    status_code: int = 200,
    *,
    json_body: dict[str, Any] | None = None,
    text: str = "",
) -> MagicMock:
    response = MagicMock(spec=requests.Response)
    response.status_code = status_code
    response.ok = 200 <= status_code < 300
    response.headers = {}
    response.text = text
    response.json.return_value = json_body if json_body is not None else _fake_directions_body()
    return response


@override_settings(
    OPENROUTESERVICE_API_KEY=SecretStr("test-key"),
    OPENROUTESERVICE_BASE_URL=_BASE_URL,
)
def test_success_returns_directions_result_and_posts_correct_payload() -> None:
    with patch(
        "web_api.integrations.openrouteservice._session.post",
        return_value=_fake_response(),
    ) as mock_post:
        result = directions_hgv(_COORDS)

    assert isinstance(result, DirectionsResult)
    assert result.summary.distance_mi == pytest.approx(342.7)
    assert result.summary.duration_s == 19080
    assert len(result.segments) == 2
    assert result.segments[0].from_index == 0
    assert result.segments[0].to_index == 1
    assert result.segments[0].distance_mi == pytest.approx(67.4)
    assert result.segments[0].duration_s == 4321
    assert result.segments[1].from_index == 1
    assert result.segments[1].to_index == 2
    assert len(result.polyline) == 3
    assert result.polyline[0] == [-77.4360, 37.5407]

    mock_post.assert_called_once()
    url = mock_post.call_args.args[0]
    body = mock_post.call_args.kwargs["json"]
    headers = mock_post.call_args.kwargs["headers"]
    assert url == f"{_BASE_URL}{_DIRECTIONS_PATH}"
    assert body == {
        "coordinates": [[-77.4360, 37.5407], [-77.4605, 38.3032], [-74.1724, 40.7357]],
        "instructions": True,
        "units": "mi",
        "preference": "recommended",
    }
    assert headers["Authorization"] == "test-key"
    assert headers["Content-Type"] == "application/json"
    assert mock_post.call_args.kwargs["timeout"] == 15.0


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_400_raises_request_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(status_code=400),
        ),
        pytest.raises(OrsRequestError),
    ):
        directions_hgv(_COORDS)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_401_raises_request_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(status_code=401),
        ),
        pytest.raises(OrsRequestError),
    ):
        directions_hgv(_COORDS)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_429_raises_rate_limit_per_minute() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(status_code=429),
        ),
        pytest.raises(OrsRateLimitError) as excinfo,
    ):
        directions_hgv(_COORDS)
    assert excinfo.value.window == "per-minute"


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_403_with_quota_body_raises_rate_limit_daily() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(
                status_code=403,
                text='{"error":"Quota exceeded for this day."}',
            ),
        ),
        pytest.raises(OrsRateLimitError) as excinfo,
    ):
        directions_hgv(_COORDS)
    assert excinfo.value.window == "daily"


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_403_without_quota_body_raises_request_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(
                status_code=403,
                text='{"error":"Forbidden: invalid key."}',
            ),
        ),
        pytest.raises(OrsRequestError),
    ):
        directions_hgv(_COORDS)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_503_after_retry_raises_upstream_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(status_code=503),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        directions_hgv(_COORDS)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_transport_error_raises_upstream_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            side_effect=requests.ConnectionError("nope"),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        directions_hgv(_COORDS)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_malformed_body_no_features_raises_upstream_error() -> None:
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(json_body={"features": []}),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        directions_hgv(_COORDS)


@override_settings(OPENROUTESERVICE_API_KEY=SecretStr("test-key"))
def test_way_points_length_mismatch_raises_upstream_error() -> None:
    body = _fake_directions_body()
    body["features"][0]["properties"]["way_points"] = [0, 2]  # off-by-one
    with (
        patch(
            "web_api.integrations.openrouteservice._session.post",
            return_value=_fake_response(json_body=body),
        ),
        pytest.raises(OrsUpstreamError),
    ):
        directions_hgv(_COORDS)
