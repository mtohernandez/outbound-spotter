"""Type definitions for the HOS planner. Plain dataclasses, frozen + slotted.

These are intentionally separate from any Django model so the planner can be
exercised in isolation. A thin adapter (defined under ``web_api/apps/<feature>/``
later) will materialize ``LogEvent`` instances into rows.

The ``DutyStatus`` codes mirror §395.8 RODS duty-status categories
(``docs/interstate-truck-driver-guide.md:185-191``). ``DirectionsResult``
and its peers are imported under ``TYPE_CHECKING`` only — see decision m1
in ``context/specs/05-hos-planner-foundation.md``: the integrations module
imports Django + requests at top-level, and a runtime import here would
pull those into the HOS test process.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    from web_api.integrations.openrouteservice import DirectionsResult


CYCLE_HOURS_MIN: Final = Decimal("0.0")
CYCLE_HOURS_MAX: Final = Decimal("70.0")


class DutyStatus(StrEnum):
    OFF_DUTY = "off_duty"
    SLEEPER_BERTH = "sleeper_berth"
    DRIVING = "driving"
    ON_DUTY_NOT_DRIVING = "on_duty_not_driving"


@dataclass(frozen=True, slots=True)
class LogEvent:
    status: DutyStatus
    start: datetime
    duration: timedelta
    location: str
    note: str = ""


@dataclass(frozen=True, slots=True)
class PlannerInputs:
    """Single entry point for ``plan_logs``. Validated at construction time.

    Field shapes derive from spec 04 (``DirectionsResult``) plus the assessment
    brief's three driver inputs (current, pickup, dropoff are implicit in the
    directions; cycle hours and start time are explicit). ``home_terminal_tz``
    is the §395.8 home-terminal time zone the events are stamped in
    (``docs/interstate-truck-driver-guide.md:176``).
    """

    directions: DirectionsResult
    cycle_hours_used: Decimal
    start_at: datetime
    home_terminal_tz: ZoneInfo

    def __post_init__(self) -> None:
        if not (CYCLE_HOURS_MIN <= self.cycle_hours_used <= CYCLE_HOURS_MAX):
            raise ValueError(f"cycle_hours_used out of range [0.0..70.0]: {self.cycle_hours_used}")
        if self.start_at.tzinfo is None:
            raise ValueError("start_at must be tz-aware")
        if self.directions.summary.distance_mi <= 0:
            raise ValueError("directions.summary.distance_mi must be positive")
        if not self.directions.polyline:
            raise ValueError("directions.polyline must be non-empty")


@dataclass(frozen=True, slots=True)
class FuelStop:
    """A pre-computed fueling location along the trip polyline.

    Anchored to an actual polyline vertex so future reverse-geocoding can
    surface a real "near <city>" label without re-snapping.
    """

    polyline_index: int
    cumulative_mi: float
    lat: float
    lon: float
