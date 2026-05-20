"""Dev-only sanity script — runs ``plan_logs`` over the assessment trip and prints events.

Run via ``cd apps/web-api && uv run python -m web_api.hos._smoke``.

This is the "trucker-level UX" check spec 05 added in lieu of a browser walk
(spec 06 ships the FE wire-up). The reviewer can run it and eyeball the
event sequence against the John Doe narrative in
``docs/interstate-truck-driver-guide.md:207-222``.

This file is BOUNDARY-EXEMPT by name in ``tests/hos/test_boundary.py``:
constructing a runtime ``DirectionsResult`` requires importing it from the
integrations module (which pulls Django at module load). The exception is
safe because ``_smoke.py`` is invoked directly by a developer and is not
imported transitively by ``web_api.hos``'s library code.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
import math
import sys
from zoneinfo import ZoneInfo

from web_api.hos import DutyStatus, LogEvent, PlannerInputs, plan_logs
from web_api.hos.fueling import EARTH_RADIUS_MI
from web_api.integrations.openrouteservice import (
    DirectionsResult,
    DirectionsSegment,
    DirectionsSummary,
)

_HOME_TZ = ZoneInfo("America/New_York")
_START_AT = datetime(2024, 4, 15, 6, 0, tzinfo=_HOME_TZ)
_MI_PER_DEGREE_LAT = math.pi * EARTH_RADIUS_MI / 180.0


def _synth_directions(
    distances_mi: list[float],
    durations_s: list[int],
    *,
    start_lat: float = 37.5407,
    start_lon: float = -77.4360,
    polyline_density_mi: float = 5.0,
) -> DirectionsResult:
    polyline: list[list[float]] = [[start_lon, start_lat]]
    segments: list[DirectionsSegment] = []
    cur_lat = start_lat
    from_index = 0
    for dist, dur in zip(distances_mi, durations_s, strict=True):
        if dist <= 0:
            segments.append(
                DirectionsSegment(
                    distance_mi=dist, duration_s=dur, from_index=from_index, to_index=from_index
                )
            )
            continue
        n_steps = max(1, int(dist / polyline_density_mi))
        step_lat = (dist / n_steps) / _MI_PER_DEGREE_LAT
        for _ in range(n_steps):
            cur_lat += step_lat
            polyline.append([start_lon, cur_lat])
        to_index = len(polyline) - 1
        segments.append(
            DirectionsSegment(
                distance_mi=dist, duration_s=dur, from_index=from_index, to_index=to_index
            )
        )
        from_index = to_index
    summary = DirectionsSummary(
        distance_mi=float(sum(distances_mi)),
        duration_s=int(sum(durations_s)),
    )
    return DirectionsResult(polyline=polyline, summary=summary, segments=segments)


def _format_duration(d: timedelta) -> str:
    total_min = int(d.total_seconds() // 60)
    hours, minutes = divmod(total_min, 60)
    if hours and minutes:
        return f"{hours}h {minutes:02d}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


_STATUS_GLYPH: dict[DutyStatus, str] = {
    DutyStatus.OFF_DUTY: "OFF",
    DutyStatus.SLEEPER_BERTH: "SB",
    DutyStatus.DRIVING: "DRV",
    DutyStatus.ON_DUTY_NOT_DRIVING: "ON",
}


def _print_events(title: str, events: list[LogEvent]) -> None:
    print(f"\n=== {title} ({len(events)} events) ===")
    print(f"{'start':<20} {'duration':<10} {'status':<5} {'location':<22} note")
    print("-" * 90)
    for ev in events:
        print(
            f"{ev.start.strftime('%Y-%m-%d %H:%M %Z'):<20} "
            f"{_format_duration(ev.duration):<10} "
            f"{_STATUS_GLYPH[ev.status]:<5} "
            f"{ev.location:<22} "
            f"{ev.note}"
        )


def _run() -> None:
    scenarios = [
        (
            "assessment_simple — Richmond → Fredericksburg → Newark (~340 mi, 0 cycle)",
            _synth_directions([60.0, 280.0], [3600, 18000]),
            Decimal("0.0"),
        ),
        (
            "assessment_break_only — synthesized 9h continuous-drive single leg",
            _synth_directions([0.0, 600.0], [0, 9 * 3600]),
            Decimal("0.0"),
        ),
        (
            "assessment_long_haul — Richmond → Phoenix (~2300 mi, 0 cycle)",
            _synth_directions([300.0, 2000.0], [4 * 3600, 30 * 3600]),
            Decimal("0.0"),
        ),
        (
            "assessment_cycle_cap — Richmond → Phoenix at 60.0 cycle hours used",
            _synth_directions([300.0, 2000.0], [4 * 3600, 30 * 3600]),
            Decimal("60.0"),
        ),
    ]
    for title, directions, cycle in scenarios:
        inputs = PlannerInputs(
            directions=directions,
            cycle_hours_used=cycle,
            start_at=_START_AT,
            home_terminal_tz=_HOME_TZ,
        )
        events = plan_logs(inputs)
        _print_events(title, events)


if __name__ == "__main__":
    _run()
    sys.exit(0)
