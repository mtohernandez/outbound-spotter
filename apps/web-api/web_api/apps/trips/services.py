"""Trip planning pipeline (spec 04).

``plan_trip`` is the only entry point. It creates the ``Trip`` row in
``PLANNING``, looks up the SHA256-keyed ``TripRouteCache`` (so reviewers can
re-run trips without burning the HeiGIT 2000/day quota), calls ORS Directions
on a miss, and transitions the row to ``PLANNED`` or ``FAILED`` before
returning. The view layer renders whatever Trip this returns; FAILED is not
an exception, it is a row state the FE branches on (spec 04 decision 14).
"""

from __future__ import annotations

from dataclasses import asdict
import hashlib
from typing import TYPE_CHECKING, Any, Final

from django.db import transaction

from web_api.apps.trips.models import Trip, TripRouteCache, TripStatus
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
    OrsRateLimitError,
    OrsRequestError,
    OrsUpstreamError,
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
    """Create a Trip and resolve its route via ORS.

    On success the returned Trip has ``status=PLANNED`` and the four route
    fields populated. On any ORS error the returned Trip has ``status=FAILED``
    and a non-null ``route_error_code``; the exception is captured here and
    NOT re-raised so the view returns 201 with the discriminated row.
    """
    coords = _coords_from_serializer(serializer_data)

    with transaction.atomic():
        trip = Trip.objects.create(
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
            status=TripStatus.PLANNING,
        )

    try:
        result = _resolve_directions(coords)
    except OrsRateLimitError as exc:
        return _mark_failed(
            trip,
            "rate_limit_daily" if exc.window == "daily" else "rate_limit_per_minute",
        )
    except OrsUpstreamError:
        return _mark_failed(trip, "upstream")
    except OrsRequestError:
        return _mark_failed(trip, "validation")

    trip.route_polyline = result.polyline
    trip.route_segments = [asdict(s) for s in result.segments]
    trip.route_summary = asdict(result.summary)
    trip.status = TripStatus.PLANNED
    trip.save(update_fields=["route_polyline", "route_segments", "route_summary", "status"])
    return trip


def _resolve_directions(coords: _TripCoords) -> DirectionsResult:
    canonical, cache_key = _build_cache_key(coords)
    cached = TripRouteCache.objects.filter(pk=cache_key).first()
    if cached is not None:
        return _hydrate_payload(cached.payload)

    result = directions_hgv(list(coords))
    # IntegrityError on a concurrent insert under the same key is benign —
    # both rows hold the same payload. Swallowing it keeps the request green.
    TripRouteCache.objects.update_or_create(
        cache_key=cache_key,
        defaults={"coords_canonical": canonical, "payload": asdict(result)},
    )
    return result


def _coords_from_serializer(data: Mapping[str, Any]) -> _TripCoords:
    """Return ((cur_lon, cur_lat), (pickup_lon, pickup_lat), (dropoff_lon, dropoff_lat)).

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


def _mark_failed(trip: Trip, route_error_code: str) -> Trip:
    trip.route_error_code = route_error_code
    trip.status = TripStatus.FAILED
    trip.save(update_fields=["route_error_code", "status"])
    return trip
