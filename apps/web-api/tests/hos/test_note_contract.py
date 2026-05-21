"""Cross-module contract: planner ``LogEvent.note`` prefixes ↔ adapter mapping.

The adapter in ``web_api.apps.trips.hos_adapter`` classifies planner events
by note-prefix matching (``_NOTE_TO_KIND``). The planner emits notes via
``web_api.hos.planner._make_constraint_event`` and
``web_api.hos.planner._emit_static_leg``. There is no compile-time link
between the two surfaces — this test is the runtime link.

If a future planner change reworks a note string, this test fails before
the adapter mis-classifies in production. Co-located in ``tests/hos/`` so
it shares fate with the spec-05 import-boundary gate that already pins the
planner's public surface.

Architect-review M1 / code-reviewer C1 against spec 06.
"""

from __future__ import annotations

from web_api.apps.trips.hos_adapter import (
    _NOTE_FUELING,
    _NOTE_OFF_DUTY_PREFIX,
    _NOTE_PICKUP_PREFIX,
    _NOTE_RESTART_PREFIX,
    _NOTE_TO_KIND,
    _stop_kind_from_event,
)
from web_api.apps.trips.models import StopKind


def test_note_prefixes_are_pairwise_non_overlapping() -> None:
    """No prefix is a left-substring of another — guards the linear scan."""
    prefixes = list(_NOTE_TO_KIND.keys())
    for i, outer in enumerate(prefixes):
        for j, inner in enumerate(prefixes):
            if i == j:
                continue
            assert not inner.startswith(outer), (
                f"Prefix {inner!r} starts with {outer!r}; the linear scan in "
                f"_stop_kind_from_event would mis-classify (whichever "
                f"appears first in dict iteration order wins)."
            )


def test_classification_for_each_canonical_planner_note() -> None:
    """Lock the de-facto contract: the strings the planner actually emits."""
    from datetime import UTC, datetime, timedelta  # noqa: PLC0415

    from web_api.hos.types import DutyStatus, LogEvent  # noqa: PLC0415

    start = datetime(2030, 1, 15, 13, 0, tzinfo=UTC)
    one_hour = timedelta(hours=1)

    canonical_cases: list[tuple[DutyStatus, str, StopKind | None]] = [
        # planner._emit_static_leg
        (DutyStatus.ON_DUTY_NOT_DRIVING, "Pickup loading", StopKind.PICKUP),
        (DutyStatus.ON_DUTY_NOT_DRIVING, "Dropoff unloading", StopKind.DROPOFF),
        # planner._make_constraint_event
        (DutyStatus.OFF_DUTY, "34-hour restart (§395.3(c)(1))", StopKind.RESTART),
        (DutyStatus.OFF_DUTY, "10-hour off-duty (§395.3(a)(1))", StopKind.SLEEPER),
        (DutyStatus.OFF_DUTY, "10-hour off-duty (§395.3(a)(2))", StopKind.SLEEPER),
        (DutyStatus.OFF_DUTY, "30-min break (§395.3(a)(3)(ii))", StopKind.BREAK),
        (DutyStatus.ON_DUTY_NOT_DRIVING, "Fueling", StopKind.FUEL),
        # DRIVING events never become stops
        (DutyStatus.DRIVING, "", None),
        # SLEEPER_BERTH (currently unreachable but planner-public)
        (DutyStatus.SLEEPER_BERTH, "", StopKind.SLEEPER),
    ]

    for status, note, expected_kind in canonical_cases:
        event = LogEvent(status=status, start=start, duration=one_hour, location="0, 0", note=note)
        assert _stop_kind_from_event(event) == expected_kind, (
            f"Classification drift for {status.value!r} + {note!r}: "
            f"expected {expected_kind}, got {_stop_kind_from_event(event)}"
        )


def test_note_prefix_constants_match_table_keys() -> None:
    """Belt-and-suspenders: the named constants and the dict keys are the same set."""
    expected = {
        _NOTE_PICKUP_PREFIX,
        "Dropoff",
        _NOTE_FUELING,
        _NOTE_RESTART_PREFIX,
        "30-min break",
        _NOTE_OFF_DUTY_PREFIX,
    }
    assert set(_NOTE_TO_KIND.keys()) == expected
