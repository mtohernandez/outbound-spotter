"""Golden: synthesized ~600 mi single-leg trip; current and pickup co-located.

Per architect-review M1 (spec decision 13): isolates ``apply_break``. The
9h continuous-drive single leg trips zero rules except the 30-minute break
after 8 cumulative driving hours.

Synthesis inputs:
- segments: 0 mi current→pickup (zero-distance — skipped); 600 mi pickup→dropoff in 9h.
- cycle_hours_used = 0.0
- start_at = 2024-04-15 06:00 America/New_York (EDT).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from web_api.hos.types import DutyStatus, LogEvent

_TZ = ZoneInfo("America/New_York")


SEGMENTS_MI = [0.0, 600.0]
SEGMENTS_DURATION_S = [0, 9 * 3600]
START_AT = datetime(2024, 4, 15, 6, 0, tzinfo=_TZ)


EXPECTED_EVENTS: list[LogEvent] = [
    # docs/assesment.md:19 — "1 hour for pickup and drop-off"; current==pickup
    # so the current→pickup driving leg is skipped (decision 7).
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 6, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="37.5407, -77.4360",
        note="Pickup loading",
    ),
    # §395.8 — DRIVING. First 8h chunk; sliced by §395.3(a)(3)(ii) at 8h cumulative.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 7, 0, tzinfo=_TZ),
        duration=timedelta(hours=8),
        location="37.5407, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — 30-minute break after 8 cumulative driving hours.
    # docs/interstate-truck-driver-guide.md:127-133.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 15, 15, 0, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="45.2597, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. Remaining 1h chunk after the break.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 15, 30, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="45.2597, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — "1 hour for pickup and drop-off".
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 16, 30, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="46.2246, -77.4360",
        note="Dropoff unloading",
    ),
]
