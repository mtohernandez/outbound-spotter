"""Golden: Richmond, VA → Fredericksburg, VA → Newark, NJ, 0 cycle hours.

The reviewer's first sanity check. Total ~340 mi, ~6h 18m of work, no fueling
(< 1000 mi), no break (drive < 8h cumulative), no off-duty (total < 14h).
Translates the assessment's three-address model with the spec-mandated
on-duty events (pickup, dropoff) and no inspection events (decision 7).

Synthesis inputs:
- segments: 60 mi current→pickup in 1h, 280 mi pickup→dropoff in 5h.
- cycle_hours_used = 0.0
- start_at = 2024-04-15 06:00 America/New_York (EDT, UTC-4 — clean DST window).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from web_api.hos.types import DutyStatus, LogEvent

_TZ = ZoneInfo("America/New_York")


SEGMENTS_MI = [60.0, 280.0]
SEGMENTS_DURATION_S = [3600, 18000]
START_AT = datetime(2024, 4, 15, 6, 0, tzinfo=_TZ)


EXPECTED_EVENTS: list[LogEvent] = [
    # §395.8 — DRIVING. ORS-routed current → pickup segment, 60 mi in 1h.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 6, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="37.5407, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — "1 hour for pickup and drop-off".
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 7, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="38.4091, -77.4360",
        note="Pickup loading",
    ),
    # §395.8 — DRIVING. ORS-routed pickup → dropoff, 280 mi in 5h.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 8, 0, tzinfo=_TZ),
        duration=timedelta(hours=5),
        location="38.4091, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — "1 hour for pickup and drop-off".
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 13, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="42.4616, -77.4360",
        note="Dropoff unloading",
    ),
]
