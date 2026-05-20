"""End-to-end byte-equal replays of the four hand-authored goldens.

Each test passes the golden's declared inputs through ``plan_logs`` and asserts
the result matches ``EXPECTED_EVENTS`` exactly. Plus two structural invariants
that hold across all goldens:

- ``test_cycle_cap_subsumes_window`` — when the cycle-cap golden hits 70/8, it
  emits exactly one ≥34h OFF_DUTY at the cap-trigger point with no preceding
  10h OFF_DUTY (architect-review M2).
- ``test_all_durations_minute_aligned`` — every event's duration is a whole
  number of minutes (architect-review m2, decision 6).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from itertools import pairwise

import pytest

from tests.hos.conftest import DEFAULT_HOME_TZ, make_directions
from tests.hos.golden import (
    assessment_break_only,
    assessment_cycle_cap,
    assessment_long_haul,
    assessment_simple,
)
from web_api.hos import plan_logs
from web_api.hos.types import DutyStatus, LogEvent, PlannerInputs

GOLDENS = [
    pytest.param(assessment_simple, id="assessment_simple"),
    pytest.param(assessment_break_only, id="assessment_break_only"),
    pytest.param(assessment_long_haul, id="assessment_long_haul"),
    pytest.param(assessment_cycle_cap, id="assessment_cycle_cap"),
]


def _inputs_from_golden(golden: object) -> PlannerInputs:
    return PlannerInputs(
        directions=make_directions(
            golden.SEGMENTS_MI,  # type: ignore[attr-defined]
            golden.SEGMENTS_DURATION_S,  # type: ignore[attr-defined]
        ),
        cycle_hours_used=getattr(golden, "CYCLE_HOURS_USED", Decimal("0.0")),
        start_at=golden.START_AT,  # type: ignore[attr-defined]
        home_terminal_tz=DEFAULT_HOME_TZ,
    )


@pytest.mark.parametrize("golden", GOLDENS)
def test_golden_byte_equal(golden: object) -> None:
    inputs = _inputs_from_golden(golden)
    actual = plan_logs(inputs)
    expected: list[LogEvent] = golden.EXPECTED_EVENTS  # type: ignore[attr-defined]
    assert actual == expected, _diff_events(actual, expected)


@pytest.mark.parametrize("golden", GOLDENS)
def test_all_durations_minute_aligned(golden: object) -> None:
    """Decision 6 / architect-review m2: every emitted duration is whole minutes."""
    inputs = _inputs_from_golden(golden)
    events = plan_logs(inputs)
    for ev in events:
        seconds = ev.duration.total_seconds()
        assert seconds % 60 == 0, f"non-minute-aligned duration: {seconds}s in {ev!r}"


@pytest.mark.parametrize("golden", GOLDENS)
def test_events_are_contiguous(golden: object) -> None:
    """Every event N ends at event N+1's start — no gaps, no overlaps."""
    inputs = _inputs_from_golden(golden)
    events = plan_logs(inputs)
    for prev, curr in pairwise(events):
        prev_end = prev.start + prev.duration
        assert prev_end == curr.start, (
            f"gap between events: {prev!r} ends {prev_end}, next starts {curr.start}"
        )


def test_cycle_cap_subsumes_window() -> None:
    """Architect-review M2: when 70/8 cap fires, no preceding 10h OFF_DUTY at the same boundary."""
    inputs = _inputs_from_golden(assessment_cycle_cap)
    events = plan_logs(inputs)

    restart_indices = [
        i
        for i, ev in enumerate(events)
        if ev.status == DutyStatus.OFF_DUTY and ev.duration >= timedelta(hours=34)
    ]
    assert len(restart_indices) == 1, f"expected one 34h restart, got {len(restart_indices)}"

    restart_idx = restart_indices[0]
    # The event immediately preceding the restart must be DRIVING (cycle cap fires
    # at end of the last allowed driving chunk), NOT a 10h OFF_DUTY.
    preceding = events[restart_idx - 1]
    assert preceding.status == DutyStatus.DRIVING, (
        f"expected DRIVING immediately before 34h restart, got {preceding!r}"
    )

    # And no 10h OFF_DUTY event landed at the same moment as the restart.
    restart_start = events[restart_idx].start
    for ev in events:
        if ev.start == restart_start and ev is not events[restart_idx]:
            pytest.fail(f"another event at the restart boundary: {ev!r}")


def _diff_events(actual: list[LogEvent], expected: list[LogEvent]) -> str:
    """Build a readable per-event diff for golden mismatches."""
    lines = [f"actual has {len(actual)} events, expected {len(expected)}"]
    for i in range(max(len(actual), len(expected))):
        a = actual[i] if i < len(actual) else None
        e = expected[i] if i < len(expected) else None
        if a != e:
            lines.append(f"  [{i}] actual:   {a!r}")
            lines.append(f"  [{i}] expected: {e!r}")
    return "\n".join(lines)
