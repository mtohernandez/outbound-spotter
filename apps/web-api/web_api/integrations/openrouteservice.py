"""OpenRouteService client.

Wraps the HeiGIT-hosted ORS instance at ``https://api.openrouteservice.org``.
Endpoints documented at:
https://giscience.github.io/openrouteservice/api-reference/endpoints/
- ``/geocode/autocomplete`` — as-you-type Pelias lookup.
- ``/geocode/search`` — full-string Pelias lookup.
- ``/v2/directions/driving-hgv/geojson`` — truck-aware routing (spec 04).

Architecture invariant #3 (``context/architecture.md``): the ORS API key never
crosses the browser. Every caller in the codebase goes through this module.

The shared ``_session`` retries on transient 5xx for both GET and POST. This is
safe because every ORS endpoint called here is read-only-effectively: Pelias
is query-only, and Directions takes a request body but never mutates server
state. A future ORS endpoint that mutates state must build its own session
with POST removed from ``Retry.allowed_methods``.
"""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import TYPE_CHECKING, Any, Final

from django.conf import settings
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from typing import Literal

    from pydantic import SecretStr

_logger = logging.getLogger(__name__)


# A single Session reuses TLS connections across calls (saves ~50-150 ms per
# request to api.openrouteservice.org). The Retry policy attempts one extra
# attempt on transient 5xx and connection errors, with backoff; 429 is NOT
# retried (callers know to back off via OrsRateLimitError). POST is included
# because the Directions endpoint takes a JSON body but never mutates state
# (see module docstring).
def _build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=1,
        backoff_factor=0.3,
        status_forcelist=(502, 503, 504),
        allowed_methods=frozenset({"GET", "POST"}),
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


_session = _build_session()


_AUTOCOMPLETE_PATH: Final = "/geocode/autocomplete"
_SEARCH_PATH: Final = "/geocode/search"
_REVERSE_PATH: Final = "/geocode/reverse"
_DIRECTIONS_PATH: Final = "/v2/directions/driving-hgv/geojson"
_REQUEST_TIMEOUT_SECONDS: Final = 5.0
_DIRECTIONS_TIMEOUT_SECONDS: Final = 15.0
_MIN_SIZE: Final = 1
_MAX_SIZE: Final = 10
_BOUNDARY_COUNTRY: Final = "US"
_STATUS_BAD_REQUEST: Final = 400
_STATUS_UNAUTHORIZED: Final = 401
_STATUS_FORBIDDEN: Final = 403
_STATUS_RATE_LIMIT: Final = 429
_STATUS_SERVER_ERROR_MIN: Final = 500
_STATUS_SERVER_ERROR_MAX: Final = 600
_MIN_COORD_PAIR_LEN: Final = 2
_QUOTA_HINT_TOKEN: Final = "quota"  # noqa: S105 — ORS body marker, not a credential


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


@dataclass(frozen=True, slots=True)
class DirectionsSegment:
    """One leg of a routed trip (N-1 segments for N input coordinates)."""

    distance_mi: float
    duration_s: int
    from_index: int
    to_index: int


@dataclass(frozen=True, slots=True)
class DirectionsSummary:
    """Per-trip totals returned by ORS."""

    distance_mi: float
    duration_s: int


@dataclass(frozen=True, slots=True)
class DirectionsResult:
    """Parsed `driving-hgv` response. Polyline is a list of `[lon, lat]` pairs."""

    polyline: list[list[float]]
    summary: DirectionsSummary
    segments: list[DirectionsSegment]


class OrsError(Exception):
    """Base class for OpenRouteService failures surfaced to callers."""


class OrsRequestError(OrsError):
    """Upstream returned a 4xx other than 429 (caller-side error)."""


class OrsRateLimitError(OrsError):
    """Upstream returned a quota signal (429 per-minute, or 403 + ``quota`` body).

    The ``window`` literal distinguishes the two so the view layer can choose a
    user-facing copy (per-minute retry hint vs daily exhaustion). The FE only
    ever sees the unified ``route_error_code`` enum.
    """

    def __init__(self, message: str, *, window: Literal["per-minute", "daily"]) -> None:
        super().__init__(message)
        self.window: Literal["per-minute", "daily"] = window


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


def geocode_reverse(lat: float, lon: float, *, size: int = 1) -> list[PeliasFeature]:
    """Coordinate-to-address lookup against Pelias ``/geocode/reverse``.

    Pelias docs: https://github.com/pelias/documentation/blob/master/reverse.md
    Returns the same `PeliasFeature` shape as ``geocode_search`` so the FE
    consumes one envelope from `/api/geocode/reverse/` and `/api/geocode/search/`.
    """
    params: dict[str, str | int | float] = {
        "point.lat": lat,
        "point.lon": lon,
        "size": _clamp_size(size),
        "boundary.country": _BOUNDARY_COUNTRY,
    }
    return _fetch(_REVERSE_PATH, params)


def _clamp_size(value: int) -> int:
    return max(_MIN_SIZE, min(_MAX_SIZE, value))


def _api_key() -> str:
    secret: SecretStr = settings.OPENROUTESERVICE_API_KEY
    return secret.get_secret_value()


def _fetch(path: str, params: Mapping[str, str | int | float]) -> list[PeliasFeature]:
    base_url: str = settings.OPENROUTESERVICE_BASE_URL
    headers = {"Authorization": _api_key(), "Accept": "application/geo+json"}
    try:
        response = _session.get(
            f"{base_url}{path}",
            params=dict(params),
            headers=headers,
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise OrsUpstreamError("OpenRouteService unreachable.") from exc

    if response.status_code == _STATUS_RATE_LIMIT:
        # Pelias only returns 429 — daily vs per-minute isn't distinguishable
        # at this endpoint. Default to per-minute (the recoverable window) so
        # the FE copy invites a retry rather than a 24h wait.
        raise OrsRateLimitError("OpenRouteService quota exhausted.", window="per-minute")
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


def directions_hgv(coordinates: Sequence[tuple[float, float]]) -> DirectionsResult:
    """Truck-aware routing via ORS Directions ``driving-hgv`` (GeoJSON variant).

    ``coordinates`` is a sequence of ``(lon, lat)`` pairs in the order the
    driver traverses them: current → pickup → dropoff. ORS encodes coordinates
    as ``[lon, lat]`` on the wire; this signature matches that convention so
    the caller cannot accidentally flip the order.

    Spec 04 decision 4: body uses ``preference=recommended``, ``units=mi``,
    ``instructions=false`` (turn-by-turn not visualized in v1).
    """
    base_url: str = settings.OPENROUTESERVICE_BASE_URL
    # ORS quirk: ``instructions: false`` strips the entire ``segments`` array
    # from the response (not just each segment's ``steps`` field), which kills
    # the per-leg distance/duration we render on the route summary. Keep
    # ``instructions: true`` and ignore ``steps`` server-side.
    body: dict[str, Any] = {
        "coordinates": [[lon, lat] for lon, lat in coordinates],
        "instructions": True,
        "units": "mi",
        "preference": "recommended",
    }
    headers = {
        "Authorization": _api_key(),
        "Accept": "application/geo+json",
        "Content-Type": "application/json",
    }
    try:
        response = _session.post(
            f"{base_url}{_DIRECTIONS_PATH}",
            json=body,
            headers=headers,
            timeout=_DIRECTIONS_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise OrsUpstreamError("OpenRouteService unreachable.") from exc

    _log_quota_headers(response)
    _raise_for_directions_status(response)

    try:
        payload: Any = response.json()
    except ValueError as exc:
        raise OrsUpstreamError("OpenRouteService returned non-JSON body.") from exc
    if not isinstance(payload, dict):
        raise OrsUpstreamError("OpenRouteService returned non-object JSON body.")

    return _parse_directions(payload)


def _log_quota_headers(response: requests.Response) -> None:
    remaining = response.headers.get("x-ratelimit-remaining")
    reset = response.headers.get("x-ratelimit-reset")
    if remaining is not None or reset is not None:
        _logger.debug(
            "ors directions quota: remaining=%s reset=%s",
            remaining,
            reset,
        )


def _raise_for_directions_status(response: requests.Response) -> None:
    code = response.status_code
    if code == _STATUS_RATE_LIMIT:
        raise OrsRateLimitError(
            "OpenRouteService per-minute quota exhausted.",
            window="per-minute",
        )
    if code == _STATUS_FORBIDDEN:
        if _QUOTA_HINT_TOKEN in (response.text or "").lower():
            raise OrsRateLimitError(
                "OpenRouteService daily quota exhausted.",
                window="daily",
            )
        raise OrsRequestError("OpenRouteService rejected the request (403 non-quota).")
    if code == _STATUS_UNAUTHORIZED:
        raise OrsRequestError("OpenRouteService rejected the request (401).")
    if code == _STATUS_BAD_REQUEST:
        raise OrsRequestError("OpenRouteService rejected the request (400).")
    if _STATUS_SERVER_ERROR_MIN <= code < _STATUS_SERVER_ERROR_MAX:
        raise OrsUpstreamError(f"OpenRouteService returned {code}.")
    if not response.ok:
        raise OrsRequestError(f"OpenRouteService rejected the request ({code}).")


def _parse_directions(payload: Mapping[str, Any]) -> DirectionsResult:
    features = payload.get("features")
    if not isinstance(features, list) or not features:
        raise OrsUpstreamError("OpenRouteService directions response missing features.")
    feature = features[0]
    if not isinstance(feature, dict):
        raise OrsUpstreamError("OpenRouteService directions feature is not an object.")

    geometry = feature.get("geometry")
    properties = feature.get("properties")
    if not isinstance(geometry, dict) or not isinstance(properties, dict):
        raise OrsUpstreamError("OpenRouteService directions feature shape malformed.")

    polyline = _parse_polyline(geometry.get("coordinates"))
    summary = _parse_summary(properties.get("summary"))
    segments = _parse_segments(properties.get("segments"), properties.get("way_points"))
    return DirectionsResult(polyline=polyline, summary=summary, segments=segments)


def _parse_polyline(raw: object) -> list[list[float]]:
    if not isinstance(raw, list) or not raw:
        raise OrsUpstreamError("OpenRouteService polyline missing or empty.")
    polyline: list[list[float]] = []
    for pair in raw:
        if not isinstance(pair, list) or len(pair) < _MIN_COORD_PAIR_LEN:
            raise OrsUpstreamError("OpenRouteService polyline pair malformed.")
        try:
            polyline.append([float(pair[0]), float(pair[1])])
        except (TypeError, ValueError) as exc:
            raise OrsUpstreamError("OpenRouteService polyline non-numeric.") from exc
    return polyline


def _parse_summary(raw: object) -> DirectionsSummary:
    if not isinstance(raw, dict):
        raise OrsUpstreamError("OpenRouteService directions summary malformed.")
    try:
        distance_mi = float(raw["distance"])
        duration_s = round(float(raw["duration"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise OrsUpstreamError("OpenRouteService directions summary fields missing.") from exc
    return DirectionsSummary(distance_mi=distance_mi, duration_s=duration_s)


def _parse_segments(raw_segments: object, raw_way_points: object) -> list[DirectionsSegment]:
    if not isinstance(raw_segments, list) or not isinstance(raw_way_points, list):
        raise OrsUpstreamError("OpenRouteService segments or way_points missing.")
    if len(raw_way_points) != len(raw_segments) + 1:
        raise OrsUpstreamError("OpenRouteService way_points length mismatch with segments.")

    segments: list[DirectionsSegment] = []
    for i, segment in enumerate(raw_segments):
        if not isinstance(segment, dict):
            raise OrsUpstreamError("OpenRouteService segment is not an object.")
        try:
            distance_mi = float(segment["distance"])
            duration_s = round(float(segment["duration"]))
            from_index = int(raw_way_points[i])
            to_index = int(raw_way_points[i + 1])
        except (KeyError, TypeError, ValueError) as exc:
            raise OrsUpstreamError("OpenRouteService segment fields malformed.") from exc
        segments.append(
            DirectionsSegment(
                distance_mi=distance_mi,
                duration_s=duration_s,
                from_index=from_index,
                to_index=to_index,
            )
        )
    return segments
