"""OpenRouteService Pelias geocoder client.

Wraps the HeiGIT-hosted Pelias instance at ``https://api.openrouteservice.org``.
Endpoints documented at:
https://giscience.github.io/openrouteservice/api-reference/endpoints/geocoder/
- ``/geocode/autocomplete`` — as-you-type lookup.
- ``/geocode/search`` — full-string lookup.

Architecture invariant #3 (``context/architecture.md``): the ORS API key never
crosses the browser. Every caller in the codebase goes through this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final

from django.conf import settings
import requests

if TYPE_CHECKING:
    from collections.abc import Mapping

    from pydantic import SecretStr


_AUTOCOMPLETE_PATH: Final = "/geocode/autocomplete"
_SEARCH_PATH: Final = "/geocode/search"
_REQUEST_TIMEOUT_SECONDS: Final = 5.0
_MIN_SIZE: Final = 1
_MAX_SIZE: Final = 10
_BOUNDARY_COUNTRY: Final = "US"
_STATUS_RATE_LIMIT: Final = 429
_STATUS_SERVER_ERROR_MIN: Final = 500
_STATUS_SERVER_ERROR_MAX: Final = 600
_MIN_COORD_PAIR_LEN: Final = 2


@dataclass(frozen=True, slots=True)
class PeliasFeature:
    """A single Pelias geocoder result, surfaced as flat scalars.

    Coordinates land as separate fields because the source GeoJSON encodes them
    as ``geometry.coordinates: [lon, lat]`` — a footgun we lock at the boundary.
    """

    label: str
    country_a: str | None
    region_a: str | None
    locality: str | None
    confidence: float | None
    match_type: str | None
    lat: float
    lon: float


class OrsError(Exception):
    """Base class for OpenRouteService failures surfaced to callers."""


class OrsRequestError(OrsError):
    """Upstream returned a 4xx other than 429 (caller-side error)."""


class OrsRateLimitError(OrsError):
    """Upstream returned 429 — daily/per-minute quota exhausted."""


class OrsUpstreamError(OrsError):
    """Upstream returned 5xx, was unreachable, or returned a malformed body."""


def geocode_autocomplete(
    text: str,
    *,
    focus: tuple[float, float] | None = None,
    size: int = 5,
) -> list[PeliasFeature]:
    """As-you-type lookup against Pelias ``/geocode/autocomplete``.

    ``focus`` is an optional ``(lat, lon)`` bias point that nudges results
    toward the driver's current location.
    """
    params: dict[str, str | int | float] = {
        "text": text,
        "size": _clamp_size(size),
        "boundary.country": _BOUNDARY_COUNTRY,
    }
    if focus is not None:
        focus_lat, focus_lon = focus
        params["focus.point.lat"] = focus_lat
        params["focus.point.lon"] = focus_lon
    return _fetch(_AUTOCOMPLETE_PATH, params)


def geocode_search(text: str, *, size: int = 1) -> list[PeliasFeature]:
    """Full-string lookup against Pelias ``/geocode/search``."""
    params: dict[str, str | int | float] = {
        "text": text,
        "size": _clamp_size(size),
        "boundary.country": _BOUNDARY_COUNTRY,
    }
    return _fetch(_SEARCH_PATH, params)


def _clamp_size(value: int) -> int:
    return max(_MIN_SIZE, min(_MAX_SIZE, value))


def _api_key() -> str:
    secret: SecretStr = settings.OPENROUTESERVICE_API_KEY
    return secret.get_secret_value()


def _fetch(path: str, params: Mapping[str, str | int | float]) -> list[PeliasFeature]:
    base_url: str = settings.OPENROUTESERVICE_BASE_URL
    headers = {"Authorization": _api_key(), "Accept": "application/geo+json"}
    try:
        response = requests.get(
            f"{base_url}{path}",
            params=dict(params),
            headers=headers,
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise OrsUpstreamError("OpenRouteService unreachable.") from exc

    if response.status_code == _STATUS_RATE_LIMIT:
        raise OrsRateLimitError("OpenRouteService quota exhausted.")
    if _STATUS_SERVER_ERROR_MIN <= response.status_code < _STATUS_SERVER_ERROR_MAX:
        raise OrsUpstreamError(f"OpenRouteService returned {response.status_code}.")
    if not response.ok:
        raise OrsRequestError(
            f"OpenRouteService rejected the request ({response.status_code}).",
        )

    try:
        body: Any = response.json()
    except ValueError as exc:
        raise OrsUpstreamError("OpenRouteService returned non-JSON body.") from exc

    if not isinstance(body, dict):
        raise OrsUpstreamError("OpenRouteService returned non-object JSON body.")

    raw_features = body.get("features")
    if raw_features is None:
        return []
    if not isinstance(raw_features, list):
        raise OrsUpstreamError("OpenRouteService features list malformed.")

    return [_parse_feature(feature) for feature in raw_features]


def _parse_feature(feature: object) -> PeliasFeature:
    if not isinstance(feature, dict):
        raise OrsUpstreamError("OpenRouteService feature is not an object.")

    geometry = feature.get("geometry")
    properties = feature.get("properties")
    if not isinstance(geometry, dict) or not isinstance(properties, dict):
        raise OrsUpstreamError("OpenRouteService feature shape malformed.")

    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < _MIN_COORD_PAIR_LEN:
        raise OrsUpstreamError("OpenRouteService feature missing coordinates.")

    try:
        lon = float(coordinates[0])
        lat = float(coordinates[1])
    except (TypeError, ValueError) as exc:
        raise OrsUpstreamError("OpenRouteService coordinates non-numeric.") from exc

    label = properties.get("label")
    if not isinstance(label, str) or not label:
        raise OrsUpstreamError("OpenRouteService feature missing label.")

    return PeliasFeature(
        label=label,
        country_a=_opt_str(properties, "country_a"),
        region_a=_opt_str(properties, "region_a"),
        locality=_opt_str(properties, "locality"),
        confidence=_opt_float(properties, "confidence"),
        match_type=_opt_str(properties, "match_type"),
        lat=lat,
        lon=lon,
    )


def _opt_str(properties: Mapping[str, Any], key: str) -> str | None:
    value = properties.get(key)
    return value if isinstance(value, str) else None


def _opt_float(properties: Mapping[str, Any], key: str) -> float | None:
    value = properties.get(key)
    if isinstance(value, (int, float)):
        return float(value)
    return None
