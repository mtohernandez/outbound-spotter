"""Golden: Richmond → Phoenix at cycle_hours_used = 60.0 — forces a 34h restart.

Per architect-review M2 (spec decision 13): exercises the cycle-cap-subsumes-window
scenario. When the planner hits the 70-hour cap, it inserts exactly ONE 34-hour
off-duty event and does NOT also emit a preceding 10-hour off-duty event at the
same boundary. ``test_planner_goldens.py::test_cycle_cap_subsumes_window``
asserts this invariant.

Synthesis inputs:
- segments: 300 mi current→pickup in 4h, 2000 mi pickup→dropoff in 30h.
- cycle_hours_used = 60.0  (driver has already worked 60h in the rolling 8-day window)
- start_at = 2024-04-15 06:00 America/New_York (EDT).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from web_api.hos.types import DutyStatus, LogEvent

_TZ = ZoneInfo("America/New_York")


SEGMENTS_MI = [300.0, 2000.0]
SEGMENTS_DURATION_S = [4 * 3600, 30 * 3600]
START_AT = datetime(2024, 4, 15, 6, 0, tzinfo=_TZ)
CYCLE_HOURS_USED = Decimal("60.0")


EXPECTED_EVENTS: list[LogEvent] = [
    # §395.8 — DRIVING. current → pickup, 300 mi in 4h.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 6, 0, tzinfo=_TZ),
        duration=timedelta(hours=4),
        location="37.5407, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — pickup.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 10, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="41.8826, -77.4360",
        note="Pickup loading",
    ),
    # §395.8 — DRIVING. 4h before break boundary.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 11, 0, tzinfo=_TZ),
        duration=timedelta(hours=4),
        location="41.8826, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — break at 8h cumulative drive since last break.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 15, 15, 0, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="45.7422, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. 1h until cycle cap (state.cycle = 69.0; cap = 70.0).
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 15, 15, 30, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="45.7422, -77.4360",
        note="",
    ),
    # §395.3(c)(1) — 34h restart fires at cycle = 70.0. Subsumes the 10h
    # off-duty that drive-limit would have emitted (architect-review M2).
    # docs/interstate-truck-driver-guide.md:156-159.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 15, 16, 30, tzinfo=_TZ),
        duration=timedelta(hours=34),
        location="46.7070, -77.4360",
        note="34-hour restart (§395.3(c)(1))",
    ),
    # §395.8 — DRIVING. 5h 29m post-restart until 1000-mi fuel threshold.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 17, 2, 30, tzinfo=_TZ),
        duration=timedelta(hours=5, minutes=29),
        location="46.7070, -77.4360",
        note="",
    ),
    # docs/assesment.md:18 — fueling.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 17, 7, 59, tzinfo=_TZ),
        duration=timedelta(minutes=15),
        location="52.0139, -77.4360",
        note="Fueling",
    ),
    # §395.8 — DRIVING. 2h 31m before break boundary.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 17, 8, 14, tzinfo=_TZ),
        duration=timedelta(hours=2, minutes=31),
        location="52.0139, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — break.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 17, 10, 45, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="54.4261, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. 3h until drive-limit.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 17, 11, 15, tzinfo=_TZ),
        duration=timedelta(hours=3),
        location="54.4261, -77.4360",
        note="",
    ),
    # §395.3(a)(1) — 10h off-duty after 11h drive-in-window.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 17, 14, 15, tzinfo=_TZ),
        duration=timedelta(hours=10),
        location="57.3207, -77.4360",
        note="10-hour off-duty (§395.3(a)(1))",
    ),
    # §395.8 — DRIVING. 8h until break boundary.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 18, 0, 15, tzinfo=_TZ),
        duration=timedelta(hours=8),
        location="57.3207, -77.4360",
        note="",
    ),
    # §395.3(a)(3)(ii) — break.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 18, 8, 15, tzinfo=_TZ),
        duration=timedelta(minutes=30),
        location="65.0397, -77.4360",
        note="30-min break (§395.3(a)(3)(ii))",
    ),
    # §395.8 — DRIVING. 1h 29m until 2000-mi fuel threshold.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 18, 8, 45, tzinfo=_TZ),
        duration=timedelta(hours=1, minutes=29),
        location="65.0397, -77.4360",
        note="",
    ),
    # docs/assesment.md:18 — fueling.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 18, 10, 14, tzinfo=_TZ),
        duration=timedelta(minutes=15),
        location="66.4870, -77.4360",
        note="Fueling",
    ),
    # §395.8 — DRIVING. 1h 31m until drive-limit hits 11h in window.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 18, 10, 29, tzinfo=_TZ),
        duration=timedelta(hours=1, minutes=31),
        location="66.4870, -77.4360",
        note="",
    ),
    # §395.3(a)(1) — second 10h off-duty.
    LogEvent(
        status=DutyStatus.OFF_DUTY,
        start=datetime(2024, 4, 18, 12, 0, tzinfo=_TZ),
        duration=timedelta(hours=10),
        location="67.9343, -77.4360",
        note="10-hour off-duty (§395.3(a)(1))",
    ),
    # §395.8 — DRIVING. Final 3h.
    LogEvent(
        status=DutyStatus.DRIVING,
        start=datetime(2024, 4, 18, 22, 0, tzinfo=_TZ),
        duration=timedelta(hours=3),
        location="67.9343, -77.4360",
        note="",
    ),
    # docs/assesment.md:19 — dropoff.
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 19, 1, 0, tzinfo=_TZ),
        duration=timedelta(hours=1),
        location="70.8290, -77.4360",
        note="Dropoff unloading",
    ),
]
