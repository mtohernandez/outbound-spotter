"""Type definitions for the HOS planner. Plain dataclasses, frozen + slotted.

These are intentionally separate from any Django model so the planner can be
exercised in isolation. A thin adapter (defined under web_api/apps/<feature>/
later) will materialize these into LogEvent rows.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from datetime import datetime, timedelta


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
