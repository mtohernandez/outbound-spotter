"""Fueling — find every 1000-mile threshold along a routed polyline.

Per ``docs/assesment.md:18`` ("Fueling at least once every 1,000 miles") the
planner emits a 15-minute ``ON_DUTY_NOT_DRIVING`` event at each fueling stop.
Stops snap to actual polyline vertices so future reverse-geocoding can label
them by city.

Algorithm is O(N) on polyline vertex count. Earth radius constant is the
IUGG 2015 mean radius rounded to 4 decimals (https://en.wikipedia.org/wiki/Earth_radius#Mean_radius).
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Final

from web_api.hos.types import FuelStop

if TYPE_CHECKING:
    from collections.abc import Sequence

    from web_api.integrations.openrouteservice import DirectionsSegment


EARTH_RADIUS_MI: Final[float] = 3958.7613
FUEL_STOP_INTERVAL_MI: Final[float] = 1000.0
# A 5% slack absorbs ORS internal smoothing without hiding a real bug
# (typical haversine-vs-ORS-summary delta is < 1% on US highway polylines).
SUMMARY_TOLERANCE: Final[float] = 0.05


def _haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return EARTH_RADIUS_MI * c


def fuel_stop_indices(
    polyline: Sequence[Sequence[float]],
    segments: Sequence[DirectionsSegment],
) -> list[FuelStop]:
    """Return a fueling stop at each 1000-mile threshold along ``polyline``.

    ``polyline`` is a sequence of ``[lon, lat]`` pairs per ORS GeoJSON
    convention. ``segments`` is used as a sanity check: if the haversine
    integral disagrees with the ORS-reported segment-total by > 5% the call
    fails loud — a malformed polyline shouldn't silently misplace fuel stops.
    """
    if not polyline:
        raise ValueError("polyline must be non-empty")

    cum_mi: list[float] = [0.0]
    for i in range(1, len(polyline)):
        prev = polyline[i - 1]
        curr = polyline[i]
        cum_mi.append(cum_mi[-1] + _haversine_mi(prev[1], prev[0], curr[1], curr[0]))

    total_mi = cum_mi[-1]
    if total_mi <= 0:
        raise ValueError("polyline integrates to zero distance")

    segments_total = sum(seg.distance_mi for seg in segments)
    if segments_total > 0 and abs(total_mi - segments_total) / segments_total > SUMMARY_TOLERANCE:
        raise ValueError(
            f"polyline integral {total_mi:.2f} mi disagrees with segments total "
            f"{segments_total:.2f} mi by > {SUMMARY_TOLERANCE * 100:.0f}%"
        )

    stops: list[FuelStop] = []
    threshold = FUEL_STOP_INTERVAL_MI
    while threshold <= total_mi:
        best_index = 0
        best_delta = abs(cum_mi[0] - threshold)
        for i in range(1, len(cum_mi)):
            delta = abs(cum_mi[i] - threshold)
            # `<` (not `<=`) preserves the tie-break-earlier-vertex contract.
            if delta < best_delta:
                best_delta = delta
                best_index = i
        vertex = polyline[best_index]
        stops.append(
            FuelStop(
                polyline_index=best_index,
                cumulative_mi=cum_mi[best_index],
                lat=vertex[1],
                lon=vertex[0],
            )
        )
        threshold += FUEL_STOP_INTERVAL_MI

    return stops
