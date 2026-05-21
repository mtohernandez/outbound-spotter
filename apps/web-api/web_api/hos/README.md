# `web_api.hos` — HOS planner

Pure-Python module that consumes a `DirectionsResult` + `cycle_hours_used` + `start_at` and emits a deterministic `list[LogEvent]` honoring 49 CFR §395.3 (driving limits) and §395.8 (RODS duty statuses). The accuracy surface the assessment grades against.

## §395 → file map

| Regulation                                       | Citation                                                           | Implemented in                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 11-hour driving limit                            | §395.3(a)(1) — `docs/interstate-truck-driver-guide.md:93-97`       | `rules.py::apply_drive_limit`; slicing in `planner.py::_max_drive_chunk`     |
| 14-hour driving window                           | §395.3(a)(2) — `docs/interstate-truck-driver-guide.md:87-91`       | `rules.py::apply_off_duty_window`; slicing in `planner.py::_max_drive_chunk` |
| 30-minute break after 8 cumulative driving hours | §395.3(a)(3)(ii) — `docs/interstate-truck-driver-guide.md:127-133` | `rules.py::apply_break`; slicing in `planner.py::_max_drive_chunk`           |
| 70-hour / 8-day on-duty limit                    | §395.3(b) — `docs/interstate-truck-driver-guide.md:137-159`        | `rules.py::apply_cycle_cap`                                                  |
| 34-hour restart                                  | §395.3(c)(1) — `docs/interstate-truck-driver-guide.md:156-159`     | `rules.py::apply_restart_recovery`                                           |
| Fueling every ≤ 1,000 miles                      | `docs/assesment.md:18` (assessment assumption — not a §395 rule)   | `fueling.py::fuel_stop_indices`; `rules.py::apply_fuel_stop`                 |

## §395.8 duty statuses → `DutyStatus`

| §395.8 category       | `DutyStatus` value                            | Where emitted                                                                                           |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Off Duty              | `OFF_DUTY = "off_duty"`                       | 10-hour rest, 30-minute break, 34-hour restart                                                          |
| Sleeper Berth         | `SLEEPER_BERTH = "sleeper_berth"`             | Reserved — equivalent to off-duty for window/cycle/break counters; v1 defaults to OFF_DUTY (decision 9) |
| Driving               | `DRIVING = "driving"`                         | Each driving sub-leg between waypoints / constraints                                                    |
| On Duty (Not Driving) | `ON_DUTY_NOT_DRIVING = "on_duty_not_driving"` | 1-hour pickup, 1-hour dropoff, 15-minute fuel stop                                                      |

## Determinism + isolation invariants

The module must stay framework-free. `apps/web-api/tests/hos/test_boundary.py` enforces this by AST-walking every `.py` file under `web_api/hos/` and asserting imports stay within the allowlist:

```python
ALLOWED_TOP_LEVEL = {
    "datetime", "dataclasses", "enum", "decimal",
    "zoneinfo", "math", "typing",
    "web_api.hos", "web_api.integrations.openrouteservice",
}
```

The `web_api.integrations.openrouteservice` allowance is **data-contract only** — `DirectionsResult` / `DirectionsSegment` / `DirectionsSummary` must be imported under `if TYPE_CHECKING:` ONLY, because the upstream module imports Django + requests at module top. The boundary test asserts the TYPE_CHECKING guard at the AST level.

The test also greps for forbidden patterns (`datetime.now`, `time.time`, `random`, `requests`, `urllib`, `django`, `rest_framework`) — any match is a CI failure.

**Senior-review hook:** any addition to `ALLOWED_TOP_LEVEL` requires architect-review re-approval AND a synchronized update to `context/architecture.md#Invariants`. The constant carries the hook comment inline; treat it as a contract, not a test fixture.

## Worked examples

See `apps/web-api/tests/hos/golden/` for hand-authored, paragraph-cited expected outputs:

- `assessment_simple.py` — Richmond → Fredericksburg → Newark, 0 cycle hours. No fueling, no break, no rest. The reviewer's first sanity check.
- `assessment_break_only.py` — Synthesized 9-hour continuous-drive single leg. Isolates §395.3(a)(3)(ii) break insertion.
- `assessment_long_haul.py` — Richmond → Phoenix, 0 cycle hours. Multi-day with 2 fueling stops, multiple breaks, multi-day off-duty.
- `assessment_cycle_cap.py` — Richmond → Phoenix at 60.0 cycle hours used. Forces a 34-hour restart mid-trip; asserts the restart subsumes any 10-hour off-duty that the window/drive rules would otherwise emit at the same boundary.

Each event in each golden carries an inline `# §395.x` or `# docs/assesment.md:N` comment. The goldens are the regulation interpretation; if a golden looks wrong, fix the golden first (with citation), then the planner — never silently align the planner to a misread of §395.

## Out of v1 scope

- §395.1(g) split-sleeper pairing options 2 & 3 — sleeper-berth duty status is recognized but pairing math is not. Per decision 9.
- §395.1(b) adverse-conditions extension. Per `context/project-overview.md`.
- §395.1(e) short-haul exception. Per `context/project-overview.md`.
- Personal conveyance, yard moves, hazmat. Per `context/project-overview.md`.
- 60-hour / 7-day schedule (only 70-hour / 8-day is implemented). Per `docs/assesment.md`.
- Pre-trip / post-trip inspection events. The assessment lists only pickup, dropoff, and fueling as on-duty events. Per decision 7.
- Driver-profile timezone — `home_terminal_tz` is plumbed from a caller-side constant in `apps/web-api/web_api/apps/trips/services.py` (spec 06). Hard-coded `America/New_York` in v1. Per decision 10.
