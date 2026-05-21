"""HOS test fixtures — frozen-dataclass factories, no factory-boy.

The HOS planner module itself imports zero Django code; this is enforced by
``test_boundary.py``. However the project-wide ``apps/web-api/tests/conftest.py``
imports ``TripFactory`` (Django-dependent), and pytest auto-loads conftest.py
upward, so ``django.setup()`` does fire in the HOS test process. The boundary
test reads source files via ``ast.parse`` rather than importing them, so it
remains correct regardless of process-level Django setup.

The trade-off is documented in spec 05 / architect-review m6: stronger
isolation (an empty ``tests/hos/pytest.ini``) was rejected because it would
force a separate pytest invocation in CI without strengthening the invariant.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta
from decimal import Decimal
import math
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from web_api.hos.fueling import EARTH_RADIUS_MI
from web_api.hos.state import PlannerState
from web_api.hos.types import DutyStatus, FuelStop, PlannerInputs
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
)

if TYPE_CHECKING:
    from collections.abc import Sequence


# Anchor the synthesized polylines on Richmond, VA so coordinates resemble the
# assessment trip even when callers pass synthesized distances.
RICHMOND_LAT = 37.5407
RICHMOND_LON = -77.4360
DEFAULT_HOME_TZ = ZoneInfo("America/New_York")
DEFAULT_START_AT = datetime(2024, 4, 15, 6, 0, tzinfo=DEFAULT_HOME_TZ)

_MI_PER_DEGREE_LAT: float = math.pi * EARTH_RADIUS_MI / 180.0


def make_directions(
    distances_mi: Sequence[float],
    durations_s: Sequence[int],
    *,
    polyline_density_mi: float = 5.0,
    start_lat: float = RICHMOND_LAT,
    start_lon: float = RICHMOND_LON,
) -> DirectionsResult:
    """Synthesize an ORS-shaped ``DirectionsResult`` for HOS tests.

    Each segment carries ``distance_mi`` and ``duration_s`` exactly as declared.
    The polyline is a straight north-bearing line built so the haversine
    integral matches ``sum(distances_mi)`` to within the planner's 5% tolerance.
    """
    if len(distances_mi) != len(durations_s):
        raise ValueError("distances_mi and durations_s must have equal length")

    polyline: list[list[float]] = [[start_lon, start_lat]]
    segments: list[DirectionsSegment] = []
    cur_lat = start_lat
    cur_lon = start_lon
    from_index = 0

    for dist, dur in zip(distances_mi, durations_s, strict=True):
        if dist <= 0:
            segments.append(
                DirectionsSegment(
                    distance_mi=dist,
                    duration_s=dur,
                    from_index=from_index,
                    to_index=from_index,
                )
            )
            continue
        n_steps = max(1, int(dist / polyline_density_mi))
        step_mi = dist / n_steps
        step_lat = step_mi / _MI_PER_DEGREE_LAT
        for _ in range(n_steps):
            cur_lat += step_lat
            polyline.append([cur_lon, cur_lat])
        to_index = len(polyline) - 1
        segments.append(
            DirectionsSegment(
                distance_mi=dist,
                duration_s=dur,
                from_index=from_index,
                to_index=to_index,
            )
        )
        from_index = to_index

    summary = DirectionsSummary(
        distance_mi=float(sum(distances_mi)),
        duration_s=int(sum(durations_s)),
    )
    return DirectionsResult(polyline=polyline, summary=summary, segments=segments)


def make_planner_inputs(
    *,
    directions: DirectionsResult | None = None,
    cycle_hours_used: Decimal = Decimal("0.0"),
    start_at: datetime = DEFAULT_START_AT,
    home_terminal_tz: ZoneInfo = DEFAULT_HOME_TZ,
) -> PlannerInputs:
    """Build a valid ``PlannerInputs`` for tests with sensible defaults."""
    if directions is None:
        directions = make_directions(distances_mi=[60.0, 280.0], durations_s=[3600, 18000])
    return PlannerInputs(
        directions=directions,
        cycle_hours_used=cycle_hours_used,
        start_at=start_at,
        home_terminal_tz=home_terminal_tz,
    )


def make_state(
    *,
    now: datetime = DEFAULT_START_AT,
    drive_window_open_at: datetime | None = None,
    cum_drive_in_window: timedelta = timedelta(0),
    cum_drive_since_break: timedelta = timedelta(0),
    cycle_hours_used_total: Decimal = Decimal("0.0"),
    last_status: DutyStatus | None = None,
    last_status_started_at: datetime | None = None,
    polyline_cursor: int = 0,
    cum_miles: float = 0.0,
    fuel_stops_remaining: tuple[FuelStop, ...] = (),
) -> PlannerState:
    """Build a ``PlannerState`` fixture without going through ``PlannerState.initial``."""
    return PlannerState(
        now=now,
        drive_window_open_at=drive_window_open_at,
        cum_drive_in_window=cum_drive_in_window,
        cum_drive_since_break=cum_drive_since_break,
        cycle_hours_used_total=cycle_hours_used_total,
        last_status=last_status,
        last_status_started_at=last_status_started_at,
        polyline_cursor=polyline_cursor,
        cum_miles=cum_miles,
        fuel_stops_remaining=fuel_stops_remaining,
    )


__all__ = [
    "DEFAULT_HOME_TZ",
    "DEFAULT_START_AT",
    "RICHMOND_LAT",
    "RICHMOND_LON",
    "make_directions",
    "make_planner_inputs",
    "make_state",
    "replace",  # re-exported for tests that need to mutate a PlannerState fixture
]
