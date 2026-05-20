"""Golden: Richmond, VA → Phoenix, AZ, 0 cycle hours — multi-day haul.

Exercises fueling, breaks, drive-limit + window resets, and multi-day off-duty.
Per spec decision 13: ~2300 mi total, ~34h of driving over multiple days,
inside the 70/8 cycle without restart.

Synthesis inputs:
- segments: 300 mi current→pickup in 4h, 2000 mi pickup→dropoff in 30h.
- cycle_hours_used = 0.0
- start_at = 2024-04-15 06:00 America/New_York (EDT).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from web_api.hos.types import DutyStatus, LogEvent

_TZ = ZoneInfo("America/New_York")


SEGMENTS_MI = [300.0, 2000.0]
SEGMENTS_DURATION_S = [4 * 3600, 30 * 3600]
START_AT = datetime(2024, 4, 15, 6, 0, tzinfo=_TZ)


EXPECTED_EVENTS: list[LogEvent] = [
    # §395.8 — DRIVING. current → pickup, 300 mi in 4h.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 6, 0, tzinfo=_TZ),
        duration=timedelta(hours=4),
        location="37.5407, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — 1h pickup ON_DUTY_NOT_DRIVING.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 10, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="41.8826, -77.4360",
        note="Pickup loading",
    ),
    # §395.8 — DRIVING. First chunk of pickup → dropoff (4h to break boundary).
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 11, 0, tzinfo=_TZ),
        duration=timedelta(hours=4),
        location="41.8826, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — 30-min break after 8h cumulative driving.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 15, 15, 0, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="45.7422, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. 3h sub-leg until drive-limit (11h cumulative).
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 15, 30, tzinfo=_TZ),
        duration=timedelta(hours=3),
        location="45.7422, -77.4360",
        note="",
    ),
    # §395.3(a)(1) — 10h off-duty after 11h driving in window.
    # docs/interstate-truck-driver-guide.md:93-97.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 15, 18, 30, tzinfo=_TZ),
        duration=timedelta(hours=10),
        location="48.6368, -77.4360",
        note="10-hour off-duty (§395.3(a)(1))",
    ),
    # §395.8 — DRIVING. 3h 29m until next fuel stop at ~1000 mi cumulative.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 16, 4, 30, tzinfo=_TZ),
        duration=timedelta(hours=3, minutes=29),
        location="48.6368, -77.4360",
        note="",
    ),
    # docs/assesment.md:18 — fueling at least every 1000 miles.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 16, 7, 59, tzinfo=_TZ),
        duration=timedelta(minutes=15),
        location="52.0139, -77.4360",
        note="Fueling",
    ),
    # §395.8 — DRIVING. Continues past fuel stop.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 16, 8, 14, tzinfo=_TZ),
        duration=timedelta(hours=4, minutes=31),
        location="52.0139, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — 30-min break at 8h cumulative drive since last break.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 16, 12, 45, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="56.3558, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. Until 11h drive-in-window hit.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 16, 13, 15, tzinfo=_TZ),
        duration=timedelta(hours=3),
        location="56.3558, -77.4360",
        note="",
    ),
    # §395.3(a)(1) — second 10h off-duty.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 16, 16, 15, tzinfo=_TZ),
        duration=timedelta(hours=10),
        location="59.2504, -77.4360",
        note="10-hour off-duty (§395.3(a)(1))",
    ),
    # §395.8 — DRIVING. 7h 29m until second fuel stop (~2000 mi).
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 17, 2, 15, tzinfo=_TZ),
        duration=timedelta(hours=7, minutes=29),
        location="59.2504, -77.4360",
        note="",
    ),
    # docs/assesment.md:18 — second fuel stop.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 17, 9, 44, tzinfo=_TZ),
        duration=timedelta(minutes=15),
        location="66.4870, -77.4360",
        note="Fueling",
    ),
    # §395.8 — DRIVING. 31m before the 8h break-since-last-break boundary.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 17, 9, 59, tzinfo=_TZ),
        duration=timedelta(minutes=31),
        location="66.4870, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — third break.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 17, 10, 30, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="66.9695, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. Until 11h drive-in-window.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 17, 11, 0, tzinfo=_TZ),
        duration=timedelta(hours=3),
        location="66.9695, -77.4360",
        note="",
    ),
    # §395.3(a)(1) — third 10h off-duty.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 17, 14, 0, tzinfo=_TZ),
        duration=timedelta(hours=10),
        location="69.8641, -77.4360",
        note="10-hour off-duty (§395.3(a)(1))",
    ),
    # §395.8 — DRIVING. Final 1h to reach dropoff.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 18, 0, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="69.8641, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — 1h dropoff.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 18, 1, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="70.8290, -77.4360",
        note="Dropoff unloading",
    ),
]
