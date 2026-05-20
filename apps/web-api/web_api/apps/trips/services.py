"""Trip planning pipeline.

``plan_trip`` is the only entry point. It looks up the SHA256-keyed
``TripRouteCache``, calls ORS Directions on a miss, then persists a single
Trip row with the resolved route in one atomic insert.

ORS errors propagate as ``OrsError`` subclasses — NO Trip row is created on
failure. The view layer maps each subclass to an HTTP error response so the
user stays on the form (post-live-smoke senior-review directive).
"""

from __future__ import annotations

from dataclasses import asdict
import hashlib
from typing import TYPE_CHECKING, Any, Final

from django.db import transaction

from web_api.apps.trips.models import Trip, TripRouteCache
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
    directions_hgv,
)

if TYPE_CHECKING:
    from collections.abc import Mapping


# Cache schema epoch. Bump to invalidate every row (e.g., when the canonical
# request shape changes — spec 09's re-planning may add avoid_features).
_CACHE_KEY_VERSION: Final = "v1"
_PROFILE: Final = "driving-hgv"
_PREFERENCE: Final = "recommended"
_UNITS: Final = "mi"
_COORD_PRECISION: Final = 5  # ~1.1 m at the equator; matches Pelias determinism


_Coord = tuple[float, float]
_TripCoords = tuple[_Coord, _Coord, _Coord]


def plan_trip(serializer_data: Mapping[str, Any], user_id: str) -> Trip:
    """Resolve the route, then persist a Trip row.

    Raises ``OrsRateLimitError`` / ``OrsRequestError`` / ``OrsUpstreamError``
    on routing failure. The view layer translates these into HTTP responses;
    no Trip row is persisted on failure (the user stays on the form).
    """
    coords = _coords_from_serializer(serializer_data)
    result = _resolve_directions(coords)

    with transaction.atomic():
        return Trip.objects.create(
            user_id=user_id,
            current_label=serializer_data["current"]["label"],
            current_lat=serializer_data["current"]["lat"],
            current_lon=serializer_data["current"]["lon"],
            pickup_label=serializer_data["pickup"]["label"],
            pickup_lat=serializer_data["pickup"]["lat"],
            pickup_lon=serializer_data["pickup"]["lon"],
            dropoff_label=serializer_data["dropoff"]["label"],
            dropoff_lat=serializer_data["dropoff"]["lat"],
            dropoff_lon=serializer_data["dropoff"]["lon"],
            cycle_hours_used=serializer_data["cycle_hours_used"],
            route_polyline=result.polyline,
            route_segments=[asdict(s) for s in result.segments],
            route_summary=asdict(result.summary),
        )


def _resolve_directions(coords: _TripCoords) -> DirectionsResult:
    canonical, cache_key = _build_cache_key(coords)
    cached = TripRouteCache.objects.filter(pk=cache_key).first()
    if cached is not None:
        return _hydrate_payload(cached.payload)

    result = directions_hgv(list(coords))
    # Django's update_or_create wraps SELECT FOR UPDATE + INSERT in its own
    # atomic block and retries on IntegrityError, so concurrent identical
    # POSTs converge to a single row instead of raising.
    TripRouteCache.objects.update_or_create(
        cache_key=cache_key,
        defaults={"coords_canonical": canonical, "payload": asdict(result)},
    )
    return result


def _coords_from_serializer(data: Mapping[str, Any]) -> _TripCoords:
    """Return ``((cur_lon, cur_lat), (pickup_lon, pickup_lat), (dropoff_lon, dropoff_lat))``.

    Lon/lat order matches ORS's wire convention so callers cannot accidentally
    flip the pair.
    """
    return (
        (float(data["current"]["lon"]), float(data["current"]["lat"])),
        (float(data["pickup"]["lon"]), float(data["pickup"]["lat"])),
        (float(data["dropoff"]["lon"]), float(data["dropoff"]["lat"])),
    )


def _build_cache_key(coords: _TripCoords) -> tuple[str, str]:
    """Return ``(canonical_string, sha256_hex)``.

    Returning both forms in one call eliminates the foot-gun where a caller
    could hash one shape and store another. ``coords_canonical`` is the
    operator-readable column on ``TripRouteCache``.
    """
    parts = [
        _CACHE_KEY_VERSION,
        _PROFILE,
        _PREFERENCE,
        _UNITS,
        *(f"{lon:.{_COORD_PRECISION}f},{lat:.{_COORD_PRECISION}f}" for lon, lat in coords),
    ]
    canonical = "|".join(parts)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return canonical, digest


def _hydrate_payload(payload: Mapping[str, Any]) -> DirectionsResult:
    """Rebuild the dataclass from a cache row's JSON payload.

    A malformed payload is a bug in our own writer (cache rows are written
    only by ``_resolve_directions`` on the success path), so we let KeyError
    / TypeError surface rather than silently fall through to a fresh ORS call.
    """
    return DirectionsResult(
        polyline=payload["polyline"],
        summary=DirectionsSummary(**payload["summary"]),
        segments=[DirectionsSegment(**segment) for segment in payload["segments"]],
    )
