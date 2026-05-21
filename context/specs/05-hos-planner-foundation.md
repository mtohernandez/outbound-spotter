# 05 — HOS planner foundation

> The accuracy surface the assessment grades against. Pure-Python `web_api/hos/` module that consumes a `DirectionsResult` (from spec 04) + `cycle_hours_used` + `start_at` and emits a deterministic `list[LogEvent]` honoring §395.3 (14-hour driving window, 11-hour driving limit, 30-minute break, 10 consecutive off-duty, 70/8 cycle cap, 34-hour restart) and §395.8 (RODS duty-status categories) of 49 CFR. No Django / DRF / HTTP imports — invariant #1 from `context/architecture.md` is the load-bearing rule. Golden tests replay the assessment's "Richmond → Fredericksburg → Newark" trip and the FMCSA John Doe narrative from `docs/interstate-truck-driver-guide.md` lines 207–222 against the module byte-for-byte.

## Goal

Land the math. After this spec ships, anyone (a test, a future Django adapter, a CLI) can call `web_api.hos.plan_logs(PlannerInputs(...))` and receive a deterministic `list[LogEvent]` that is correct against §395. Spec 06 wires the adapter that persists those events as `LogEvent` rows; spec 07 renders them on a Leaflet map; spec 08 draws them on §395.8 grids. Each downstream spec is unblocked exclusively by what this spec produces.

Three load-bearing properties this module must guarantee:

1. **Pure-Python boundary (invariant #1).** No `django`, `rest_framework`, `requests`, `urllib`, or any HTTP / ORM / web framework import inside `apps/web-api/web_api/hos/**`. A pytest boundary test under `tests/hos/test_boundary.py` walks every `.py` file in the module and asserts the import graph stays stdlib-only (`datetime`, `dataclasses`, `enum`, `decimal`, `zoneinfo`, `math`, `typing`, plus relative imports inside `web_api.hos`). The test fails CI on any drift, so future implementers cannot reach for `from django.utils import timezone` "just this once."
2. **Deterministic output.** Same `PlannerInputs` always produces the same `list[LogEvent]`. `datetime.now()`, `datetime.utcnow()`, `time.time()`, `random.*`, and any wall-clock or RNG source are forbidden inside `web_api/hos/`. The boundary test greps for these patterns. Tests freeze `start_at = datetime(2024, 4, 15, 6, 0, tzinfo=ZoneInfo("America/New_York"))` and assert bit-exact downstream timestamps.
3. **Cite-the-paragraph compliance.** Every rule function's docstring quotes the specific §395 paragraph it interprets, with a link into `docs/interstate-truck-driver-guide.md` at the line range that paraphrases the regulation. A reader can audit the math by reading the docstring + the regulation side-by-side. The accuracy bar from `docs/assesment.md` ("accuracy must be up to standards") is met by paragraph-level traceability, not by "looks right."

Inputs the module accepts (frozen `PlannerInputs` dataclass — single entry point):

- `directions: DirectionsResult` — the spec-04 `polyline` + `segments` + `summary` for the (current, pickup, dropoff) coordinate triple.
- `cycle_hours_used: Decimal` — prior cumulative on-duty time in the rolling 8-day window (0–70, `Decimal(3,1)` quantum).
- `start_at: datetime` — tz-aware, in `home_terminal_tz`. This is the **first event** start (typically the moment the driver begins the current shift).
- `home_terminal_tz: ZoneInfo` — hard-coded `ZoneInfo("America/New_York")` by callers in v1. The planner doesn't decide this; spec 06 plumbs the call site.

Output: `list[LogEvent]` — every duty-status change is exactly one event. Events are contiguous (event N ends at event N+1's `start`), tz-aware, and totalling `start[0]` to `start[-1] + duration[-1]` covers every minute of the trip.

## Decisions of record (resolved at planning time)

These are pre-resolved so the implementer doesn't re-litigate and senior review can audit the rationale. The companion plan file lives at `/Users/mateo/.claude/plans/role-you-are-a-temporal-coral.md`.

1. **Stdlib only — no third-party deps for the planner.** Allowed imports under `web_api/hos/**`: `datetime`, `dataclasses`, `enum`, `decimal`, `zoneinfo`, `math`, `typing` (`Final`, `Literal`, `Sequence`, etc.), and relative imports within the package. Forbidden: `numpy`, `pendulum`, `arrow`, anything not in the Python 3.13 stdlib. The trade-off is haversine math is hand-rolled in `fueling.py` (~10 lines) instead of pulled from `pyproj` / `geographiclib` — acceptable because (a) the precision we need is "snap to the nearest polyline vertex along a known polyline," not "great-circle distance to ±1 cm," and (b) keeping the dep surface zero makes invariant #1 trivially auditable.

2. **Immutable state ladder, not a mutable accumulator.** `PlannerState` is `@dataclass(frozen=True, slots=True)` with explicit fields (see Step 2 below). The composing loop calls `advance(state, event) -> PlannerState` which returns a NEW state — never mutates. Tests can hold a list of intermediate states and assert mid-trip invariants ("at event N, drive-window-open-at was T"). Rules consume `state` read-only. The alternative (a stateful class with `self.advance()`) is rejected because frozen-dataclass tests are bit-equal comparable and pytest snapshots them cheaply; a class with state mutation forces deepcopy ceremony in every test.

3. **One rule per function in fixed priority order.** `rules.py` exports six functions (listed in composition order):
   - `apply_cycle_cap(state, next_leg) -> Optional[LogEvent]` — §395.3(b): if `cycle_hours_used_total + next_leg.on_duty_share` would exceed `Decimal("70.0")`, emit a 34h off-duty restart (per decision 8). Runs first so it subsumes any window/drive-limit emission.
   - `apply_restart_recovery(state, next_leg) -> Optional[LogEvent]` — §395.3(c)(1)/(c)(2): not a "rule" in the same sense; called by `apply_cycle_cap` to construct the 34h block. Documented separately so the citation is independent.
   - `apply_off_duty_window(state, next_leg) -> Optional[LogEvent]` — §395.3(a)(2): if the proposed `next_leg` would extend driving past the 14h window, emit a 10-hour off-duty event first.
   - `apply_drive_limit(state, next_leg) -> Optional[LogEvent]` — §395.3(a)(1): if the proposed `next_leg` would exceed 11 cumulative driving hours in the current window, emit 10h off-duty.
   - `apply_break(state, next_leg) -> Optional[LogEvent]` — §395.3(a)(3)(ii): if the proposed `next_leg` would cross the 8-cumulative-driving-hours mark since last 30-min non-driving block, emit a 30-min off-duty break.
   - `apply_fuel_stop(state, next_leg) -> Optional[LogEvent]` — `docs/assesment.md` line 18: if the next driving micro-segment crosses the next-1000-mile-threshold polyline vertex, emit a 15-min on-duty-not-driving fuel event at that vertex BEFORE the driving event continues.

   The planner composes them in `apply_cycle_cap → apply_off_duty_window → apply_drive_limit → apply_break → apply_fuel_stop → emit leg event` order. **Cycle cap fires FIRST** so a 34h restart subsumes any 10h off-duty that the window/drive-limit rules would otherwise emit at the same boundary — otherwise both rules fire in sequence and the trip persists 44h of off-duty for what regulators read as a single rest period. (Pre-implementation architect-review finding M2 caught this; the order was originally cycle-cap-last.) The trade-off: rare 70h scenarios pay one extra short-circuit check on every leg; 99% of legs return immediately on `cycle_hours_used_total < Decimal("70.0") - epsilon`. Fueling is positional (polyline-anchored) not temporal, so it runs after any inserted rest block has reset the relevant counters. Each rule is independently unit-tested with a synthesized `PlannerState` fixture; `test_planner_goldens.py::test_cycle_cap_subsumes_window` exercises the simultaneous-trigger scenario end-to-end.

4. **Truthful fueling — cumulative ORS segment miles, snapped to the nearest polyline vertex.** `fueling.py::fuel_stop_indices(polyline, segments) -> list[FuelStop]` precomputes every 1000-mile threshold along the trip. Algorithm:
   - Build per-vertex cumulative miles by accumulating haversine distance vertex-to-vertex along `polyline`.
   - For each threshold T ∈ {1000, 2000, 3000, …} ≤ `summary.distance_mi`, find the vertex `v` whose cumulative miles is closest to T. Tie-break: prefer the earlier vertex.
   - Return `FuelStop(polyline_index, cumulative_mi, lat, lon)` for each.

   Trade-off vs. "split each leg into N equal portions": truthful interpolation lands the fuel marker on an actual highway point with real lat/lon. The naive split lands it on a synthesized midpoint — wrong on the map, wrong for any future reverse-geocoding ("near Fredericksburg, VA"), wrong for any future "stop near rest area" lookup. The compute cost is O(N) where N = polyline vertex count (a few hundred to low thousands per US trip) — negligible. Decision 4 of decisions-of-record from `/Users/mateo/.claude/plans/role-you-are-a-temporal-coral.md` codifies this; the trade-off is recorded here so future re-routing specs (ORS alternative routes) inherit the same convention.

5. **Deterministic timestamps; `datetime.now()` forbidden inside `web_api/hos/`.** Every event timestamp derives from `start_at` + a chain of `timedelta` arithmetic. The boundary test (`tests/hos/test_boundary.py`) greps for `datetime.now`, `datetime.utcnow`, `time.time`, `time.monotonic`, and `random` — any match fails. Rationale: bit-exact golden tests are the regulation-compliance contract. If the planner reads wall-clock time, the goldens become flaky and the §395 audit trail rots.

6. **`Decimal` for cycle hours; `int` seconds + `timedelta` for durations; floats forbidden inside the planner.** Cycle hours arrive from spec 06's `Trip.cycle_hours_used` as `Decimal(3,1)` and stay `Decimal` for the rolling 70/8 sum. Durations are `int` seconds in transport (ORS gives us `duration_s: int`) and `timedelta` in arithmetic. The exception is `cumulative_mi` (a `float` — ORS gives us miles as a float, and the precision loss is bounded by polyline density). The boundary test does NOT forbid float; it forbids float ON CYCLE HOUR FIELDS. Cycle-hour arithmetic in floats would drift across long-haul tests by ~1-10 ms per add, accumulating across multi-day trips — `Decimal` eliminates that. Floats stay scoped to geometry.

7. **Pickup and dropoff are `ON_DUTY_NOT_DRIVING`, 1 hour, AT THE DESTINATION of the leg.** Per `docs/assesment.md` line 19 ("1 hour for pickup and drop-off") + §395.8 duty-status categories. Sequencing:
   - Drive current → pickup. Arrive at pickup_lat/lon.
   - Emit 1h `ON_DUTY_NOT_DRIVING` at pickup location ("Pickup loading"). The window/cycle counters tick during this hour.
   - Drive pickup → dropoff. Arrive at dropoff_lat/lon.
   - Emit 1h `ON_DUTY_NOT_DRIVING` at dropoff location ("Dropoff unloading"). Trip ends.

   **Zero-distance edge cases** (pre-implementation architect-review finding m4). The spec-03 form does NOT enforce distinct addresses, and Pelias rounding can produce identical lat/lon to 5 decimal places (~1.1 m precision) for the same address entered two different ways. Threshold: an ORS leg is considered zero-distance when `segment.distance_mi < 0.01` (~52 ft — below the polyline-vertex spacing and below any legitimate "driving" interpretation). Behaviors:
   - If `segments[0]` (current → pickup) is zero-distance: skip the current→pickup `DRIVING` event entirely. The 1h pickup `ON_DUTY_NOT_DRIVING` still fires as the first event.
   - If `segments[1]` (pickup → dropoff) is zero-distance: skip the pickup→dropoff `DRIVING` event. The 1h dropoff `ON_DUTY_NOT_DRIVING` still fires immediately after the 1h pickup.
   - If both legs are zero-distance: the trip emits two consecutive 1h `ON_DUTY_NOT_DRIVING` events with no driving. The planner does not block this; the FE form should have prevented it but the math stays correct.

   The assessment does NOT mention pre-trip or post-trip inspection time. The John Doe example shows them, but adding them silently extends every trip by 1.5+ hours and contradicts the brief's strict-listing of on-duty events (pickup, dropoff, fueling). Decision: v1 omits pre/post-trip inspection events. The John Doe golden is a TRANSLATION into the assessment's model, not a byte-replay.

8. **Auto-restart on cycle-cap (§395.3(c)(1)).** When the planner detects that the next driving micro-segment would push `cycle_hours_used + on_duty_this_trip + next_leg.on_duty_share` past 70.0, it inserts a 34h off-duty block and continues. The alternative (refuse to plan; surface "trip un-plannable in cycle") is rejected because (a) the assessment expects an output for every valid trip submission, not a refusal, and (b) the FMCSA guide is explicit that restart is the driver's available tool to recover available hours — emitting it is the regulation's intended path. The user-facing flow for "driver chooses NOT to restart" is deferred to a future spec along with the optional `start_at` re-plan UI.

9. **`SLEEPER_BERTH` as a duty status is IN; §395.1(g) split-sleeper pairing options 2 & 3 are OUT of v1.** `docs/assesment.md` lists exactly four assumptions; none mention §395.1(g). `docs/interstate-truck-driver-guide.md:101–109` describes pairing as a provision a driver MAY use — not a required compliance surface. The John Doe narrative (`docs/interstate-truck-driver-guide.md:207–222`) uses `SLEEPER_BERTH` as a duty status (1h 45min mid-shift in Cherry Hill, NJ) but does NOT pair it for §395.1(g); the 14h window keeps ticking. The planner therefore:
   - Treats `SLEEPER_BERTH` as a legitimate `LogEvent.status` that the planner CAN emit (the 10h off-duty block between shifts can be encoded as `SLEEPER_BERTH` if the test prefers; v1 defaults to `OFF_DUTY` since the assessment does not differentiate).
   - Does NOT implement the pairing math (§395.1(g) options 2 & 3) — the 14h window does not pause for paired-7-hour-sleeper-plus-3-hour-off-duty combinations in v1. The 10h off-duty between shifts is always one consecutive block.

   A follow-up spec adds pairing options 2 & 3 if/when the v1 review demands it. Recorded in `context/progress-tracker.md#Next Up` as `feat/<NN>-sleeper-berth-pairing`.

10. **`home_terminal_tz` is hard-coded `America/New_York` in v1.** Per the resolved open question in the plan file. The Trip table does NOT carry a TZ column in spec 05 (and the FE form has no TZ picker). Spec 06 plumbs the value from a constant in `apps/web-api/web_api/apps/trips/services.py`. A future "driver profile" spec replaces the constant with a per-user setting.

    **TZ-crossing trips: all `LogEvent.start` timestamps are emitted in `home_terminal_tz`, regardless of the driver's geographic location at event time.** Per §395.8 / `docs/interstate-truck-driver-guide.md:176` ("You must use the time zone in effect at your home terminal. Even if you cross other time zones, record time as it is at your terminal. All drivers operating out of your home terminal must use the same starting time for the 24-hour period, as designated by your employer."). The Richmond → Phoenix goldens cross ET → CT → MT; every event is still stamped in `America/New_York`. The map renderer (spec 07) shows the driver's current geographic location independently; the §395.8 log sheets (spec 08) anchor on home-terminal time. (Pre-implementation architect-review finding m5.)

11. **`start_at` is a required `PlannerInputs` field; the planner does NOT default it.** Spec 06 wires the spec-03 form's new datetime input + the `Trip.start_at` column. Spec 05's planner refuses to compute without `start_at` — there is no `start_at = datetime.now()` fallback (would violate decision 5). Tests pass an explicit fixture. The Trip-level default ("now rounded up to next 15 min") lives in the FE form layer; the planner is wall-clock-blind.

12. **Two-tier test surface.** `tests/hos/` ships:
    - **Per-rule unit tests** (`test_rules.py`) — each rule function gets ≥ 3 cases: boundary-not-yet-triggered, boundary-just-triggered, boundary-already-past. Tests use synthesized `PlannerState` fixtures via a `make_state(**overrides)` helper; no ORS, no DB.
    - **Whole-planner golden replay** (`test_planner_goldens.py`) — at least three end-to-end goldens (see decision 13). Asserts the full `list[LogEvent]` output byte-for-byte against a hand-authored list under `tests/hos/golden/`.

    Both layers must pass; the unit layer catches rule regressions; the golden layer catches composition regressions.

13. **Four golden tests, citing the source for each event.** (Pre-implementation architect-review finding M1 added the break-only golden — the original three did not exercise `apply_break` in isolation, only incidentally on multi-day trips where a vertex shift would mask break-rule bugs.) Hand-authored in `tests/hos/golden/`:
    - `assessment_simple.py` — Richmond, VA → Fredericksburg, VA → Newark, NJ, 0 cycle hours, `start_at = 2024-04-15 06:00` in `America/New_York` (clean EDT — see decision 13 DST note below). Exercises the basic flow (drive, pickup, drive, dropoff). No fueling needed (~340 mi total), no break needed (under 8h cumulative drive), no off-duty needed (~6h 18m total trip). This is the golden the reviewer will run by hand on `/trips/new`.
    - `assessment_break_only.py` — single-leg ~600-mile synthesized trip (current and pickup co-located so the planner emits the 1h pickup immediately, then a single ~9h continuous-drive leg pickup→dropoff). `cycle_hours_used = 0`, `start_at = 2024-04-15 06:00` in `America/New_York`. The trip is < 1000 mi (no fueling), well under the 14h window and 11h drive limit (no off-duty), and well under 70/8 (no restart) — `apply_break` is the only insertion rule that fires. Expected sequence: 1h pickup ON_DUTY_NOT_DRIVING → 8h DRIVING → 30min OFF_DUTY break → ~1h DRIVING → 1h dropoff ON_DUTY_NOT_DRIVING. This golden's only purpose is to lock in the §395.3(a)(3)(ii) break rule's exact insertion timing.
    - `assessment_long_haul.py` — Richmond, VA → Phoenix, AZ, 0 cycle hours, `start_at = 2024-04-15 06:00` in `America/New_York`. ~2300 mi driving + 2h pickup/dropoff = ~37h of driving over multi-day, exercises: 2 fuel stops (at 1000, 2000 mi), multiple 30-min breaks, 3 off-duty 10h blocks (multi-day), stays inside the 70h cycle without restart.
    - `assessment_cycle_cap.py` — same Richmond → Phoenix route, but `cycle_hours_used = 60.0`. Forces a 34h restart partway through the trip. Exercises decision 8 AND the cycle-cap-subsumes-window scenario flagged by architect-review M2 — `test_planner_goldens.py::test_cycle_cap_subsumes_window` asserts that when the restart fires, no preceding 10h off-duty event is also emitted.

    **DST date choice** (pre-implementation architect-review finding m7): `2024-04-15` is well past the 2024 DST start (2024-03-10), so `ZoneInfo("America/New_York")` resolves unambiguously to EDT (UTC-4) for all golden timestamps. Earlier drafts used `2024-03-11` (one day after the DST transition) and referred to "EST" in comments — the resolved offset is actually EDT, and golden comments saying "EST" would ship a 1h naming error. All four goldens use `2024-04-15` for consistency.

    The John Doe narrative (`docs/interstate-truck-driver-guide.md:207–222`) is NOT a golden — it does not map cleanly to the assessment's three-address model (John Doe has two stops + a delivery mid-trip + a final terminal off-duty). It is cited in the rule docstrings instead, as the regulation interpretation evidence.

    Each event in each golden file has an inline comment citing the §395 paragraph (or assessment line) that justifies it. Example:

    ```python
    # docs/assesment.md:19 — "1 hour for pickup and drop-off"
    LogEvent(
        status=DutyStatus.ON_DUTY_NOT_DRIVING,
        start=datetime(2024, 4, 15, 7, 12, tzinfo=ZoneInfo("America/New_York")),
        duration=timedelta(hours=1),
        location="38.3032, -77.4605",
        note="Pickup loading",
    ),
    ```

14. **CI boundary check ships as a pytest test, not a CI-config grep.** Reason: a pytest test runs locally on every `uv run pytest` AND in CI on every push. A CI-config grep only runs on push. The pytest version is more portable, surfaces failures earlier, and doesn't require coupling to `.github/workflows/ci.yml`. The test walks `web_api/hos/**/*.py` and asserts each file's top-of-module imports stay within the stdlib + relative `web_api.hos.*` allowlist; it also greps line-by-line for forbidden patterns (`datetime.now`, `time.time`, `random`, `requests`, `urllib`, `django`, `rest_framework`). Implementation in `tests/hos/test_boundary.py`.

    **Allowlist is contract, not test fixture.** The `ALLOWED_TOP_LEVEL` set inside `test_boundary.py` is mirrored verbatim under `context/architecture.md#Invariants` (invariant #1's bullet). The test's module docstring cites the architecture.md line range as the source of truth, and the `ALLOWED_TOP_LEVEL` literal carries the comment `# senior-review-hook: any addition to this set requires architect-review re-approval and a synchronized update to context/architecture.md#Invariants — do NOT edit unilaterally.` Adding `redis` (or anything else) to the test in isolation is a senior-review violation by definition. (Pre-implementation architect-review finding M3.)

15. **`PlannerInputs` validates at construction time.** Frozen dataclass with `__post_init__` (allowed on frozen dataclasses via `object.__setattr__`-free validation — `__post_init__` runs after field assignment and may `raise`):
    - `cycle_hours_used` ∈ `Decimal("0.0")..Decimal("70.0")`.
    - `start_at.tzinfo is not None` (tz-aware required).
    - `directions.summary.distance_mi > 0` (zero-distance trips rejected).
    - `directions.polyline` non-empty.

    Validation raises `ValueError`. Spec 06's adapter catches and bubbles to the view layer (where it becomes a 400). The planner itself never returns an error result — either it raises or it produces a `list[LogEvent]`.

16. **`web_api/hos/__init__.py` is the public boundary.** Re-exports: `plan_logs`, `PlannerInputs`, `PlannerState`, `LogEvent`, `DutyStatus`, `FuelStop`. Internal modules (`rules.py`, `state.py`, `fueling.py`, `planner.py`) are NOT re-exported. Spec 06's adapter imports from `web_api.hos`, never `web_api.hos.planner`. This keeps the surface minimal and reshapeable. The `__init__.py` docstring stays exactly what spec 04 left ("No Django / DRF / HTTP imports here. CI grep enforces") and gains the new re-exports.

17. **`README.md` is required, not optional.** The HOS surface is the most regulation-dense module in the repo; a future maintainer needs the regulation-paragraph-to-file map up front. `web_api/hos/README.md` contains: (a) the §395.3 paragraph → `rules.py` function mapping, (b) the §395.8 duty-status enum → `DutyStatus` mapping, (c) the boundary invariant restated with the pytest test path and the `ALLOWED_TOP_LEVEL` allowlist mirrored from `context/architecture.md`. **NO worked example duplicated from the goldens** — the `tests/hos/golden/*.py` files ARE the worked examples; their inline `# §395.x` / `# docs/assesment.md:N` comments cover every event. README points readers to the goldens rather than duplicating them. (Pre-implementation architect-review finding m9.)

## Decisions amended post-implementation

Filled in if/when live-test surfaces a behavior the spec did not anticipate. Mirrors spec 04's "Decisions amended post-live-smoke" section so the format stays symmetric across the queue. Empty at write time.

## Scope

### In

**`apps/web-api/web_api/hos/` — pure-Python module:**

- `__init__.py` — extend (currently 6 lines) to re-export the public API per decision 16. Keep the existing boundary docstring.
- `types.py` — extend with `PlannerInputs` (frozen, slots) and `FuelStop` (frozen, slots). The existing `DutyStatus` enum and `LogEvent` dataclass are untouched.
- `state.py` (NEW) — `PlannerState` frozen dataclass + `advance(state, event) -> PlannerState` pure function. State fields:
  - `now: datetime` — current planner clock (tz-aware).
  - `drive_window_open_at: Optional[datetime]` — when the current 14h window opened, or None if no shift started.
  - `cum_drive_in_window: timedelta` — driving time since `drive_window_open_at`.
  - `cum_drive_since_break: timedelta` — driving time since the last ≥30-min non-driving block.
  - `cycle_hours_used_total: Decimal` — running 70/8 total. Starts at `inputs.cycle_hours_used`; grows with every on-duty (driving + on-duty-not-driving) event.
  - `last_status: Optional[DutyStatus]` — for break detection (consecutive non-driving aggregates).
  - `last_status_started_at: Optional[datetime]`.
  - `polyline_cursor: int` — current vertex index along `directions.polyline`.
  - `cum_miles: float` — cumulative miles driven so far.
  - `fuel_stops_remaining: tuple[FuelStop, ...]` — pre-computed, popped as consumed.
- `rules.py` (NEW) — six functions per decision 3. Each docstring quotes the §395 paragraph it interprets, with line refs into `docs/interstate-truck-driver-guide.md`.
- `fueling.py` (NEW) — `fuel_stop_indices(polyline: list[list[float]], segments: list[DirectionsSegment]) -> list[FuelStop]`. Internal helper `_haversine_mi(lat1, lon1, lat2, lon2) -> float` (stdlib `math` only). The cumulative-mile array can be derived purely from polyline geometry — `segments` are used to validate the total matches `summary.distance_mi` (sanity check, fails loud if ORS geometry and ORS summary disagree by > 5%).
- `planner.py` (NEW) — `plan_logs(inputs: PlannerInputs) -> list[LogEvent]`. Composes the rules per decision 3. The function body is the deterministic loop; rules + state changes happen in helpers that take/return the state.
- `README.md` (NEW) — per decision 17.

**`apps/web-api/tests/hos/` — test suite:**

- `__init__.py` (NEW, empty) — marks the test subpackage.
- `conftest.py` (NEW) — `make_state(**overrides) -> PlannerState` factory, `make_directions(distance_mi, n_legs=2, polyline_density=...) -> DirectionsResult` factory for synthesizing ORS-shaped fixtures without HTTP. No `@pytest.mark.django_db` — the HOS suite must run with zero DB access.

  **pytest collection isolation** (pre-implementation architect-review finding m6). pytest auto-loads conftest.py files upward from the test path, so collecting `tests/hos/test_boundary.py` would normally pull in the project-wide `apps/web-api/tests/conftest.py` — which imports `TripFactory` (a Django model factory) at module level, triggering `django.setup()` in the HOS test process. That weakens (but does not break) the determinism story: the _module under test_ still imports zero Django code, but the _test process_ is no longer Django-free.

  Resolution: `tests/hos/conftest.py` documents the convention honestly — "the HOS test process inherits Django setup from the parent conftest for factory-boy compatibility, but the `web_api/hos/` module itself imports zero Django code (enforced by `test_boundary.py`)." The boundary test reads files via `ast.parse` and grep, NOT by importing them, so it passes regardless of what `django.setup()` did in the test process. The stronger isolation (an empty `tests/hos/pytest.ini` that disables parent-conftest auto-loading) is rejected: it would force the HOS suite into a separate pytest invocation in CI, adding workflow complexity without strengthening the invariant.

- `test_boundary.py` (NEW) — decision 14. Walks `web_api/hos/**/*.py`, parses imports via `ast`, and asserts every import is in the allowlist. Also greps line-by-line for `datetime.now|datetime.utcnow|time.time|time.monotonic|^import random|from random|^import requests|from requests|^import urllib|from urllib|^import django|from django|^from rest_framework|^import rest_framework`. Test file paths are tested too — drift in any `.py` under the tree fails.
- `test_types.py` (NEW) — `PlannerInputs.__post_init__` validation (rejects negative cycle hours, naive datetimes, zero-distance directions, empty polyline). `FuelStop` round-trips through `dataclasses.asdict`.
- `test_state.py` (NEW) — `PlannerState` is frozen (assignment after construction raises); `advance` is pure (input state is unchanged); fields update per the rules below. Also includes `test_advance_sleeper_berth_equivalent_to_off_duty` — `SLEEPER_BERTH` events of ≥10h close the window, ≥34h restart the cycle, ≥30 min reset the break counter, identically to `OFF_DUTY` (per decision 9; architect-review finding m3 required this to test the otherwise-untested enum surface).
- `test_fueling.py` (NEW) — `fuel_stop_indices` returns: empty for trip < 1000 mi; one stop for 1500 mi at vertex closest to 1000 mi cumulative; two stops for 2500 mi at vertices closest to 1000 and 2000 mi; raises `ValueError` if `polyline` is empty or `summary.distance_mi` ≤ 0.
- `test_rules.py` (NEW) — per decision 12, ≥ 3 cases per rule (boundary-not-yet-triggered, boundary-just-triggered, boundary-already-past). Each rule function is exercised in isolation against synthesized state.
- `test_planner_goldens.py` (NEW) — replays the four goldens per decision 13. Each test:
  1. Construct `PlannerInputs` from a hard-coded `make_directions(...)` shape that matches the assessment scenario.
  2. Call `plan_logs(inputs)`.
  3. Assert the returned list is `assertEqual` to `tests/hos/golden/<name>.py::EXPECTED_EVENTS`.

  Also includes `test_cycle_cap_subsumes_window` — drives the `assessment_cycle_cap` scenario and explicitly asserts the resulting event list contains exactly one ≥34h `OFF_DUTY` block at the cap-trigger point, and no preceding 10h `OFF_DUTY` event (per architect-review finding M2). Also asserts an event-duration invariant: `all(event.duration.total_seconds() % 60 == 0 for event in events)` — every emitted duration is integer minutes, per decision 5's determinism contract (architect-review finding m2).

- `golden/__init__.py` (NEW, empty).
- `golden/assessment_simple.py` (NEW) — Richmond → Fredericksburg → Newark golden per decision 13.
- `golden/assessment_break_only.py` (NEW) — synthesized single-leg ~9h-continuous-drive golden per decision 13. Isolates `apply_break`.
- `golden/assessment_long_haul.py` (NEW) — Richmond → Phoenix golden per decision 13.
- `golden/assessment_cycle_cap.py` (NEW) — Richmond → Phoenix + `cycle_hours_used = 60.0` golden per decision 13.

### Out (deferred to listed specs)

- **HOS persistence + plan endpoint** → spec 06. Three new Django models (`TripStop`, `LogEvent`, `LogDay`), `services.plan_trip` extension that calls a thin adapter (`hos_adapter.py`), `GET /api/trips/<uuid:id>/plan/` endpoint. ALSO spec 06: add `start_at: datetime` to `Trip` + the trip-input form (the datetime picker). Spec 05 does NOT add a Django model or migration; the planner is module-only.
- **Leaflet map renderer** → spec 07.
- **§395.8 Daily Log SVG renderer** → spec 08.
- **PDF export** → spec 09.
- **§395.1(g) split-sleeper pairing options 2 & 3** → future spec (decision 9).
- **Driver-profile timezone** → future spec (decision 10). `home_terminal_tz` hard-coded `America/New_York` for now.
- **Driver chooses NOT to restart** → future spec (decision 8). Auto-restart is the v1 behavior.
- **Pre-trip / post-trip inspection events** → out of v1 per decision 7. The brief specifies pickup, dropoff, fueling on-duty events only.
- **60/7 cycle mode** → out of v1; the brief specifies 70/8.
- **§395.1(b) adverse-conditions extension** → out of v1; the brief specifies "no adverse driving conditions."
- **Hazmat, personal conveyance, yard moves, short-haul exception §395.1(e)** → out of scope per `context/project-overview.md`.

## Prerequisites (already true)

- Spec 04 is merged on `develop`. `web_api.integrations.openrouteservice.DirectionsResult` ships with the `polyline: list[list[float]]`, `summary: DirectionsSummary(distance_mi: float, duration_s: int)`, `segments: list[DirectionsSegment(distance_mi: float, duration_s: int, from_index: int, to_index: int)]` shape.
- `web_api/hos/__init__.py` (boundary docstring) and `web_api/hos/types.py` (`DutyStatus` enum, `LogEvent` dataclass) already exist from earlier scaffolding (May 19).
- `apps/web-api/pyproject.toml` has `pytest~=9.0.3`, `pytest-django~=4.12.0`, `mypy~=1.20.2`, `ruff~=0.15.13`, `factory-boy~=3.3.3` in dev. No new test dependency is needed (`factory-boy` is unused by spec 05 — the HOS suite uses plain `make_state` / `make_directions` factory functions, not class-based factories, because the dataclasses are frozen and `factory-boy` patterns are designed for ORM objects).
- `apps/web-api/web_api/settings/test.py` runs pytest against SQLite, but the HOS suite never touches the DB. The boundary test specifically asserts no DB access.
- Python runtime is 3.13 (per `apps/web-api/.python-version` and `pyproject.toml`). All decisions-1-allowed stdlib imports are available.

## Boundary

- Touches `apps/web-api/web_api/hos/{__init__.py, types.py, state.py, rules.py, fueling.py, planner.py, README.md}`.
- Touches `apps/web-api/tests/hos/**` (new test subpackage; sibling to the existing top-level `tests/`).
- Touches `context/{architecture.md, progress-tracker.md}` (post-implementation, last commits).
- Does **NOT** touch `apps/web-api/web_api/apps/**` (no Django models, no migrations, no views, no serializers in this spec). Spec 06 owns the adapter that wires the planner into the request path.
- Does **NOT** touch `apps/web-app/**`, `apps/web-auth/**`, `packages/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.

**Boundary is BE-only and single-system.** No FE/BE deviation argument needed; the workflow rule "one system boundary per unit" applies cleanly. The planner is pure-Python in a single module.

## Sequencing

Order matters: types and state land first so rules and fueling can compile against them; rules and fueling are independent and can be authored in either order; planner composes everything; goldens are authored last because they need the planner to run.

### Step 1 — Extend `types.py`

1. Add `PlannerInputs`:

   ```python
   @dataclass(frozen=True, slots=True)
   class PlannerInputs:
       directions: DirectionsResult
       cycle_hours_used: Decimal
       start_at: datetime
       home_terminal_tz: ZoneInfo

       def __post_init__(self) -> None:
           if not (Decimal("0.0") <= self.cycle_hours_used <= Decimal("70.0")):
               raise ValueError(f"cycle_hours_used out of range: {self.cycle_hours_used}")
           if self.start_at.tzinfo is None:
               raise ValueError("start_at must be tz-aware")
           if self.directions.summary.distance_mi <= 0:
               raise ValueError("directions.summary.distance_mi must be positive")
           if not self.directions.polyline:
               raise ValueError("directions.polyline must be non-empty")
   ```

2. Add `FuelStop`:
   ```python
   @dataclass(frozen=True, slots=True)
   class FuelStop:
       polyline_index: int
       cumulative_mi: float
       lat: float
       lon: float
   ```
3. **`DirectionsResult` / `DirectionsSegment` / `DirectionsSummary` are imported under `if TYPE_CHECKING:` ONLY.** (Pre-implementation architect-review finding m1.) Spec-04's `web_api/integrations/openrouteservice.py` imports `django.conf.settings` and `requests` at module top-level and builds a `_session = _build_session()` at module load. A runtime `from web_api.integrations.openrouteservice import DirectionsResult` would therefore pull Django + requests into the HOS test process the moment any file under `web_api/hos/` is collected — silently breaking decision 1 ("stdlib only at runtime") even though invariant #1 (no Django imports) is technically satisfied at the AST level. Solution:

   ```python
   # web_api/hos/types.py
   from __future__ import annotations  # already present
   from typing import TYPE_CHECKING

   if TYPE_CHECKING:
       from web_api.integrations.openrouteservice import (
           DirectionsResult, DirectionsSegment, DirectionsSummary,
       )
   ```

   Same pattern in `fueling.py` (which annotates `polyline: list[list[float]]` and `segments: list[DirectionsSegment]` parameters). `from __future__ import annotations` makes all annotations lazy strings; the TYPE_CHECKING block runs only under mypy / pyright, never at runtime. The boundary test asserts the symbols are imported in a TYPE_CHECKING-guarded block, NOT at module top-level: every match of `from web_api.integrations.openrouteservice import` MUST be inside an `if TYPE_CHECKING:` block (line-numbered AST check). Without this rule the cross-package allowlist is a runtime escape hatch.

### Step 2 — Implement `state.py`

1. `PlannerState` per the field list in Scope. Constructor `PlannerState.initial(inputs: PlannerInputs) -> PlannerState`:
   - `now = inputs.start_at`
   - `drive_window_open_at = None` (no shift opened yet; opens on the first non-off-duty event)
   - `cum_drive_in_window = timedelta(0)`, `cum_drive_since_break = timedelta(0)`
   - `cycle_hours_used_total = inputs.cycle_hours_used`
   - `last_status = None`, `last_status_started_at = None`
   - `polyline_cursor = 0`, `cum_miles = 0.0`
   - `fuel_stops_remaining = tuple(fuel_stop_indices(inputs.directions.polyline, inputs.directions.segments))`
2. `advance(state: PlannerState, event: LogEvent) -> PlannerState`:
   - `now = event.start + event.duration`.
   - If `event.status == DRIVING`: `cum_drive_in_window += event.duration`, `cum_drive_since_break += event.duration`, `cycle_hours_used_total += Decimal(event.duration.total_seconds()) / Decimal("3600")`. Open the window if not yet open.
   - If `event.status == ON_DUTY_NOT_DRIVING`: `cycle_hours_used_total += same`, window stays open.
   - If `event.status in {OFF_DUTY, SLEEPER_BERTH}` AND `event.duration >= timedelta(hours=10)`: window closes, all in-window counters reset to zero. Also, if `event.duration >= timedelta(hours=34)`: `cycle_hours_used_total = Decimal("0.0")` (§395.3(c)(1) restart).
   - If `event.status in {OFF_DUTY, SLEEPER_BERTH}` AND `event.duration >= timedelta(minutes=30)`: `cum_drive_since_break = timedelta(0)` (the break counter resets but the window stays open if < 10h).
   - `last_status = event.status`, `last_status_started_at = event.start`.
3. Unit tests: `test_state.py` exercises each of these transitions in isolation.

### Step 3 — Implement `fueling.py`

1. `_haversine_mi(lat1, lon1, lat2, lon2) -> float` — stdlib `math` only. Earth radius `EARTH_RADIUS_MI: Final = 3958.7613`. Returns great-circle distance in miles.
2. `fuel_stop_indices(polyline, segments) -> list[FuelStop]`:
   - Build cumulative-mile array vertex-to-vertex via haversine.
   - Sanity check: assert `abs(cumulative_mi[-1] - sum(s.distance_mi for s in segments)) / sum(...) < 0.05` (within 5% of the ORS-reported summary). Raise `ValueError` on mismatch.
   - For each T ∈ {1000, 2000, …, floor(total_mi / 1000) \* 1000}, find the vertex index with min `abs(cum_mi[i] - T)`. Return as `FuelStop`.
3. Tests cover: empty polyline → ValueError; total < 1000 → empty list; total = 1500 → one stop near vertex closest to 1000; total = 2500 → two stops; ORS summary mismatch → ValueError.

### Step 4 — Implement `rules.py`

1. Each rule function has the signature `(state: PlannerState, next_leg: PlannedLeg) -> Optional[LogEvent]`, where `PlannedLeg` is a small frozen dataclass internal to `planner.py` describing the upcoming driving micro-segment (`duration_s`, `distance_mi`, `location_label`, `polyline_index_end`).

   `PlannedLeg` is defined in `planner.py` (not `types.py`) because it's an internal composition primitive, not a public surface. Tests for `rules.py` import it via `from web_api.hos.planner import PlannedLeg`.

2. The six rule functions per decision 3. Each docstring:

   ```python
   def apply_drive_limit(state: PlannerState, next_leg: PlannedLeg) -> Optional[LogEvent]:
       """§395.3(a)(1) — 11-hour driving limit.

       If state.cum_drive_in_window + next_leg.duration would exceed 11 hours,
       emit a 10-hour OFF_DUTY block so the window resets per §395.3(a)(2).

       Cite: docs/interstate-truck-driver-guide.md:93–97 ("During the 14-hour
       'window' explained above, you are allowed to drive your truck for no
       more than 11 total hours.").
       """
   ```

3. The 30-min break rule (`apply_break`) emits an `OFF_DUTY` event of exactly 30 minutes when `cum_drive_since_break + next_leg.duration > timedelta(hours=8)`. Per §395.3(a)(3)(ii), the break may be on-duty / off-duty / sleeper berth; v1 emits `OFF_DUTY` for simplicity. The note field reads "30-min break (§395.3(a)(3)(ii))".
4. The cycle-cap rule (`apply_cycle_cap`) computes the on-duty share of the next leg (driving + any pickup/dropoff on-duty AT the destination of the leg). If `state.cycle_hours_used_total + on_duty_share > Decimal("70.0")`, emit a 34h `OFF_DUTY` block via `apply_restart_recovery`. The note field reads "34-hour restart (§395.3(c)(1))".
5. The fuel-stop rule (`apply_fuel_stop`) consumes from `state.fuel_stops_remaining`: if `state.cum_miles + next_leg.distance_mi >= state.fuel_stops_remaining[0].cumulative_mi` AND there is a remaining fuel stop ahead, emit a 15-min `ON_DUTY_NOT_DRIVING` event at the fuel-stop lat/lon. The driving leg then resumes from the fuel-stop vertex; the planner re-slices the leg.
6. Unit tests for each rule per decision 12.

### Step 5 — Implement `planner.py`

1. Internal `@dataclass(frozen=True, slots=True) class PlannedLeg`.
2. `_build_legs(inputs: PlannerInputs) -> list[PlannedLeg]` — splits `inputs.directions.segments` into per-segment legs, augments with the pickup / dropoff on-duty events at the destination of legs 0 and 1 respectively (per decision 7). Output is the ordered list of legs the planner walks.
3. `plan_logs(inputs: PlannerInputs) -> list[LogEvent]`:
   ```python
   def plan_logs(inputs: PlannerInputs) -> list[LogEvent]:
       events: list[LogEvent] = []
       state = PlannerState.initial(inputs)
       legs = _build_legs(inputs)
       for leg in legs:
           for rule in _PRE_LEG_RULES:
               inserted = rule(state, leg)
               if inserted is not None:
                   events.append(inserted)
                   state = advance(state, inserted)
           # Fuel rule is positional, can fire multiple times before this leg completes
           while True:
               fuel_event = apply_fuel_stop(state, leg)
               if fuel_event is None:
                   break
               events.append(fuel_event)
               state = advance(state, fuel_event)
           # Emit the leg's driving (or on-duty-not-driving) event
           leg_event = _emit_leg(state, leg)
           events.append(leg_event)
           state = advance(state, leg_event)
       return events
   ```
   where `_PRE_LEG_RULES = (apply_cycle_cap, apply_off_duty_window, apply_drive_limit, apply_break)`. **Cycle cap FIRST** per decision 3 — its 34h restart subsumes any 10h off-duty the subsequent rules would have emitted at the same boundary.
4. The `_emit_leg` helper produces the leg's LogEvent at `start = state.now`. The leg kind (`DRIVING` for between-waypoint legs; `ON_DUTY_NOT_DRIVING` for pickup/dropoff) is carried on `PlannedLeg`.

### Step 6 — Hand-author golden fixtures

1. Author `tests/hos/golden/assessment_simple.py` event-by-event. Cite the source for each event in an inline comment. The `EXPECTED_EVENTS: list[LogEvent]` constant is the test target.
2. Run `uv run pytest tests/hos/test_planner_goldens.py::test_assessment_simple -v`. Iterate until byte-equal: fix the planner OR fix the golden (the golden is the regulation interpretation; if it's wrong, fix it BEFORE adjusting the planner — never silently adjust the regulation to match a bug).
3. Author `assessment_break_only.py` (the synthesized ~9h-drive single-leg trip isolating `apply_break` — per decision 13 / architect-review M1). Run `test_assessment_break_only` to byte-equal.
4. Author `assessment_long_haul.py`. Iterate to byte-equal.
5. Author `assessment_cycle_cap.py`. Run BOTH `test_assessment_cycle_cap` AND `test_cycle_cap_subsumes_window` (the latter is the assertion that exactly one ≥34h `OFF_DUTY` event fires at the cap point — no preceding 10h block; per architect-review M2). Iterate to byte-equal.

### Step 7 — Boundary test + tooling green

1. `tests/hos/test_boundary.py`:

   ```python
   import ast
   import pathlib

   import pytest

   HOS_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent / "web_api" / "hos"
   ALLOWED_TOP_LEVEL = {
       "datetime", "dataclasses", "enum", "decimal",
       "zoneinfo", "math", "typing",
       "web_api.hos", "web_api.integrations.openrouteservice",
   }
   FORBIDDEN_PATTERNS = (
       "datetime.now", "datetime.utcnow", "time.time", "time.monotonic",
       "import random", "from random",
       "import requests", "from requests",
       "import urllib", "from urllib",
       "import django", "from django",
       "import rest_framework", "from rest_framework",
   )

   def test_no_forbidden_imports():
       for path in HOS_ROOT.rglob("*.py"):
           tree = ast.parse(path.read_text())
           for node in ast.walk(tree):
               # check Import / ImportFrom against ALLOWED_TOP_LEVEL
               ...

   def test_no_forbidden_patterns():
       for path in HOS_ROOT.rglob("*.py"):
           text = path.read_text()
           for pattern in FORBIDDEN_PATTERNS:
               assert pattern not in text, f"{path}: forbidden pattern {pattern!r}"
   ```

   The `assert pattern not in text` is intentionally a substring check, NOT a regex. False positives are easier to debug than false negatives. Documented in the test docstring.

2. Run the full toolchain:
   - `uv run ruff check .`
   - `uv run ruff format --check .`
   - `uv run mypy .`
   - `uv run pytest -q tests/hos/`
   - `uv run pytest -q` (full suite — spec 04 tests still green)

### Step 8 — Sub-agent passes

Per `context/ai-workflow-rules.md#Sub-agents`. Run in this order against the diff:

1. `architect-review` (`comprehensive-review`) — **First, against the SPEC TEXT** before implementation begins (mirrors spec 04 §Step 9 ordering). Catches design drift before code locks it in. Then again against the diff.
2. `code-reviewer` (`comprehensive-review`) — mandatory before PR.
3. `python-pro` (`python-development`) — mandatory. Verifies `Decimal` usage, frozen-dataclass patterns, stdlib idioms, mypy strictness compliance.
4. `test-automator` (`unit-testing`) — recommended. Verifies the golden tests are exhaustive against the rule surface; suggests edge cases.
5. `security-auditor` — skip. No I/O, no auth surface, no PII.
6. `ui-visual-validator` — skip. Pure BE.
7. `performance-engineer` — skip. The planner runs O(N) on polyline vertices; no DB; no allocations of concern; v1 trip sizes (< 5000 events) finish in < 50 ms even with pessimistic constants.

### Step 9 — Tracker + architecture updates (last commits)

- `context/architecture.md` — under **Invariants** restate #1 with the new pytest enforcement point (the existing wording mentions "CI grep" — clarify it's `tests/hos/test_boundary.py`). Under **System Boundaries** update the `apps/web-api/web_api/hos/` bullet with: "Public API: `plan_logs(inputs: PlannerInputs) -> list[LogEvent]`. Imports only stdlib + `web_api.integrations.openrouteservice.{DirectionsResult, DirectionsSegment, DirectionsSummary}` (data-contract type only)."
- `context/progress-tracker.md` — record under `## Completed`; clear `## In Progress` to None; update `## Next Up` (spec 06 = HOS persistence + `start_at` + plan endpoint; spec 07 = Leaflet map; spec 08 = §395.8 SVG renderer; spec 09 = PDF export). Add `## Open Questions` entries if any surfaced during implementation. Add `## Architecture Decisions` entries for any decisions that drifted from this spec text during implementation.

## File-level deliverables

```
apps/web-api/
├── web_api/hos/
│   ├── __init__.py                                # MODIFY: re-export plan_logs, PlannerInputs, PlannerState, LogEvent, DutyStatus, FuelStop
│   ├── types.py                                   # MODIFY: + PlannerInputs (frozen, slots, __post_init__), + FuelStop (frozen, slots)
│   ├── state.py                                   # NEW: PlannerState + advance()
│   ├── rules.py                                   # NEW: 6 rule functions, §395-cited docstrings
│   ├── fueling.py                                 # NEW: fuel_stop_indices + _haversine_mi
│   ├── planner.py                                 # NEW: plan_logs + PlannedLeg + _build_legs + _emit_leg + _PRE_LEG_RULES
│   └── README.md                                  # NEW: §395 paragraph → file map; §395.8 enum mapping; boundary invariant restated (points to goldens for worked examples)
└── tests/hos/
    ├── __init__.py                                # NEW (empty)
    ├── conftest.py                                # NEW: make_state, make_directions factories (no factory-boy)
    ├── test_boundary.py                           # NEW: forbidden-import + forbidden-pattern walk
    ├── test_types.py                              # NEW: PlannerInputs validation, FuelStop round-trip
    ├── test_state.py                              # NEW: frozen, advance() purity, field transitions
    ├── test_fueling.py                            # NEW: empty / 1 stop / 2 stops / mismatch / summary sanity
    ├── test_rules.py                              # NEW: ≥3 cases per rule
    ├── test_planner_goldens.py                    # NEW: byte-equal replay of 3 goldens
    └── golden/
        ├── __init__.py                            # NEW (empty)
        ├── assessment_simple.py                   # NEW: Richmond → Fredericksburg → Newark, 0 cycle, simple flow
        ├── assessment_break_only.py               # NEW: synthesized 9h-drive single-leg trip — isolates apply_break (per architect-review M1)
        ├── assessment_long_haul.py                # NEW: Richmond → Phoenix, 0 cycle, fueling + breaks + multi-day off-duty
        └── assessment_cycle_cap.py                # NEW: Richmond → Phoenix, 60.0 cycle, forces 34h restart + subsumes-window assertion

context/
├── architecture.md                                # MODIFY (post-implementation): #1 invariant pointer + System Boundaries hos/ bullet
└── progress-tracker.md                            # MODIFY (post-implementation, LAST commit)
```

No `pyproject.toml` change. No new dependencies. No Django models. No migrations. No view, serializer, URL, or middleware changes. No frontend changes. No `packages/ui` changes. No CI workflow changes (the boundary check ships as a pytest test).

## Existing functions / utilities to reuse (do not re-implement)

- `web_api.integrations.openrouteservice.DirectionsResult` / `DirectionsSegment` / `DirectionsSummary` — frozen dataclasses, ship as the data contract from the routing layer. Imported by `web_api/hos/types.py` and `web_api/hos/fueling.py` for type annotations. Do NOT duplicate the shape inside `web_api/hos/`.
- `web_api.hos.types.DutyStatus` / `LogEvent` — already defined; do NOT modify their field signatures. Extend `types.py` only by adding `PlannerInputs` and `FuelStop`.
- The existing `apps/web-api/tests/conftest.py` is the project-wide conftest (Clerk auth patches, `TripFactory`). The HOS suite gets its OWN `tests/hos/conftest.py` to avoid Django-dependent fixtures leaking in (`TripFactory` requires the ORM).

## Architecture invariants verified

- **#1 (HOS planner pure Python)** — this spec lands the load-bearing rule. Enforced by `tests/hos/test_boundary.py`. The pytest test is more robust than a `.github/workflows/ci.yml` grep because (a) it runs locally, (b) it walks the AST not just text, (c) it cannot be silently bypassed by a comment that contains the forbidden token.
- **#2 (every duty-status change writes a LogEvent)** — the planner emits exactly one `LogEvent` per status change. Spec 06 wires the persistence; this spec ensures the events are well-formed (contiguous, tz-aware, duty-status-cycling).
- **#3 (no raw ORS calls from browser)** — N/A (no FE).
- **#4 (no client-side HOS math)** — N/A (no FE).
- **#5 (ownership-checked mutations)** — N/A (no endpoints).
- **#6 (PDF export client-only)** — N/A.
- **#7 (theme tokens only)** — N/A (no UI).
- **#8 (no custom sub-agents)** — all reviewers come from the wshobson/agents marketplace.
- **#9 (specs drive implementation)** — this is the spec.

## Sub-agents to invoke

| Agent (plugin)                              | When                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architect-review` (`comprehensive-review`) | **First — against the SPEC TEXT** before implementation begins. Catches design drift on the module boundary, rule decomposition, immutable state ladder, golden test strategy. Then again against the diff. |
| `code-reviewer` (`comprehensive-review`)    | Mandatory before PR.                                                                                                                                                                                        |
| `python-pro` (`python-development`)         | Mandatory — `Decimal` correctness, frozen-dataclass patterns, stdlib idioms, mypy strictness compliance.                                                                                                    |
| `test-automator` (`unit-testing`)           | Recommended — verifies the goldens are exhaustive against the rule surface; suggests edge cases for `test_rules.py`.                                                                                        |
| `security-auditor`                          | Skip — no I/O, no auth, no PII.                                                                                                                                                                             |
| `ui-visual-validator`                       | Skip — no UI.                                                                                                                                                                                               |
| `performance-engineer`                      | Skip — planner is O(N) on polyline vertices; v1 trip sizes finish in < 50 ms; no DB.                                                                                                                        |

Auto-trigger: `django-expert` does NOT auto-trigger here because the module is pure Python (no Django imports). `python-pro` is the primary skill surface.

## Citations to include inline (or in PR body)

- §395.3(a)(1) — 11-hour driving limit. Cited in `rules.py::apply_drive_limit` docstring.
- §395.3(a)(2) — 14-hour driving window. Cited in `rules.py::apply_off_duty_window` docstring.
- §395.3(a)(3)(ii) — 30-minute break. Cited in `rules.py::apply_break` docstring.
- §395.3(b) — 60/70-hour on-duty limit. Cited in `rules.py::apply_cycle_cap` docstring.
- §395.3(c)(1), (c)(2) — 34-hour restart. Cited in `rules.py::apply_restart_recovery` docstring.
- §395.8 — RODS duty-status categories. Cited in `types.py` over `DutyStatus`.
- §395.2 — sleeper berth definition. Cited in `state.py::advance` where `SLEEPER_BERTH` is treated equivalently to `OFF_DUTY` for window/break purposes.
- §395.1(g) options 2 & 3 — split-sleeper pairing. Cited in `README.md` and `state.py::advance` as the explicit "OUT of v1" call.
- `docs/interstate-truck-driver-guide.md:87–222` — FMCSA driver guide narrative covering the §395.3 limits and the John Doe example. The line ranges in rule docstrings point here.
- `docs/assesment.md:14–19` — the four assumptions (70/8 cycle, no adverse conditions, 1000-mile fueling, 1h pickup/dropoff).
- `docs/assets/example-complete-grid.png` — the John Doe visual reference. Cited in `README.md` as the regulation-illustration source.
- Python 3.13 `zoneinfo`: <https://docs.python.org/3.13/library/zoneinfo.html>
- Python 3.13 `decimal`: <https://docs.python.org/3.13/library/decimal.html>
- Python 3.13 `dataclasses` (`frozen=True, slots=True` + `__post_init__`): <https://docs.python.org/3.13/library/dataclasses.html>
- Earth radius constant (`3958.7613` mi, IUGG 2015 mean radius): <https://en.wikipedia.org/wiki/Earth_radius#Mean_radius>

Third-party versions verified at PR-write time via `python -c "import sys; print(sys.version)"` for the runtime. No new dependencies added.

## Implementation anti-patterns to avoid

The user's task directive — "no over-explaining", "no over-commenting", "no dead code or irrelevant comments", "comments only for the WHY", "no premature abstraction" — translates into these prohibitions for this surface:

1. **NO `datetime.now()` / `time.time()` / `random.*` inside `web_api/hos/`.** Enforced by the boundary test. Failure mode: the planner becomes non-deterministic and golden tests fail flakily.
2. **NO float arithmetic on cycle hours.** `Decimal` only on `cycle_hours_used_total`. Floats are allowed for geometry (`cum_miles`, polyline coords) where ORS supplies float and the precision loss is bounded by polyline density.
3. **NO Django imports** anywhere under `web_api/hos/`. No `from django.utils.timezone import now`. No `from django.db.models import Model`. The boundary test catches every variant.
4. **NO multi-paragraph docstrings.** Each rule function has a 2-4 line docstring quoting the §395 paragraph. The `README.md` carries the long-form explanation; do not duplicate it inline.
5. **NO commented-out code.** No `# TODO: handle pairing later`. Use `## Open Questions` in `progress-tracker.md` instead.
6. **NO premature abstraction.** Six concrete rule functions, not a `Rule` protocol with subclasses. The planner composes them by name (`_PRE_LEG_RULES = (...)`), not via registry / discovery. Three similar rules is fine; abstract on the fourth if it ever happens.
7. **NO unused exports in `__init__.py`.** Re-export only what spec 06's adapter and the tests need. Internal helpers (`_build_legs`, `_emit_leg`, `_haversine_mi`, `_PRE_LEG_RULES`, `PlannedLeg`) stay private — underscore prefix and absent from `__init__.py`.
8. **NO `factory-boy` factories for the HOS dataclasses.** Frozen dataclasses don't play with `factory-boy`'s mutation model; plain `make_state` / `make_directions` Python factory functions in `tests/hos/conftest.py` are simpler and clearer. The boundary test does not forbid `factory-boy` but the HOS suite shouldn't use it.
9. **NO test that asserts WHAT the planner does without citing the §395 paragraph driving the assertion.** Test docstrings cite the regulation paragraph; commit messages do the same. Future-you reads the test and understands which regulation interpretation it locks in.
10. **NO golden test that "looks right" without a paragraph citation per event.** The golden files have inline `# §395.x` / `# docs/assesment.md:N` comments on every event. The reviewer can audit the golden by reading the comments.

## Verification (the unit is not done until every box is ticked)

- [ ] `cd apps/web-api && uv run ruff check .` is green.
- [ ] `cd apps/web-api && uv run ruff format --check .` is green.
- [ ] `cd apps/web-api && uv run mypy .` is green (strict mode passes; no `# type: ignore` added inside `web_api/hos/`).
- [ ] `cd apps/web-api && uv run pytest -q tests/hos/` is green.
- [ ] `cd apps/web-api && uv run pytest -q` (full suite — spec 04 tests still green) is green.
- [ ] `tests/hos/test_boundary.py` passes; manual `grep -rn 'django\|rest_framework\|requests\|urllib\|datetime.now\|time.time\|import random' apps/web-api/web_api/hos/` returns no real hits (only the boundary test's own pattern array references).
- [ ] `pnpm exec turbo run lint typecheck test build --affected` is green (web-app / web-auth unchanged, just confirming no incidental breakage).
- [ ] `pnpm format:check` is green.
- [ ] Four goldens (`assessment_simple`, `assessment_break_only`, `assessment_long_haul`, `assessment_cycle_cap`) replay byte-equal against the planner output. The PR body lists each event count and the §395 paragraphs the goldens exercise.
- [ ] `test_cycle_cap_subsumes_window` passes — the cycle-cap golden emits exactly one ≥34h `OFF_DUTY` event at the cap-trigger point with NO preceding 10h block (architect-review M2).
- [ ] `test_advance_sleeper_berth_equivalent_to_off_duty` passes — `SLEEPER_BERTH` events of ≥10h close the window, ≥34h restart the cycle, ≥30 min reset the break counter, identically to `OFF_DUTY` (architect-review m3).
- [ ] All emitted `LogEvent.duration` values are integer minutes (`event.duration.total_seconds() % 60 == 0`) — asserted in `test_planner_goldens.py` (architect-review m2).
- [ ] `web_api/hos/__init__.py` re-exports: `plan_logs`, `PlannerInputs`, `PlannerState`, `LogEvent`, `DutyStatus`, `FuelStop`. Nothing else.
- [ ] `web_api/hos/types.py` and `web_api/hos/fueling.py` import `DirectionsResult` / `DirectionsSegment` / `DirectionsSummary` ONLY under `if TYPE_CHECKING:` — boundary test asserts this AST-level (architect-review m1).
- [ ] `tests/hos/test_boundary.py::ALLOWED_TOP_LEVEL` carries the `# senior-review-hook` comment AND is mirrored verbatim in `context/architecture.md#Invariants` under #1 (architect-review M3).
- [ ] Every rule function in `rules.py` has a docstring quoting the specific §395 paragraph it interprets, plus a line reference into `docs/interstate-truck-driver-guide.md`.
- [ ] `web_api/hos/README.md` exists and includes: §395 paragraph-to-file map; §395.8 duty-status enum → `DutyStatus` mapping; the boundary invariant restated with pytest path + `ALLOWED_TOP_LEVEL` mirror. Points readers to `tests/hos/golden/*.py` for worked examples rather than duplicating them.
- [ ] `architect-review` was invoked **against the SPEC TEXT** before implementation began; any findings were resolved or rejected with written rationale before any code landed.
- [ ] `code-reviewer`, `architect-review` (against the diff), `python-pro` have reviewed the diff; no unresolved CRITICAL findings.
- [ ] Branch `feat/05-hos-planner-foundation`; PR base `develop`.
- [ ] `.github/pull_request_template.md` filled verbatim; Conventional Commit subjects (`feat(hos): …`, `test(hos): …`, `docs(hos): …`); no `Co-Authored-By` trailer; no `--no-verify` used.
- [ ] `context/architecture.md` updated with the pytest boundary-test pointer and the public-API `plan_logs` signature.
- [ ] `context/progress-tracker.md` updated as the **last** committed file — spec 05 → Completed; Next Up updated (spec 06 = HOS persistence + `start_at` + plan endpoint; spec 07 = Leaflet map; spec 08 = §395.8 SVG renderer; spec 09 = PDF export).

## Out of scope (deliberate — don't touch in this unit)

- HOS persistence (`TripStop`, `LogEvent`, `LogDay` Django models) → spec 06.
- `start_at` field on `Trip` model + form datetime picker → spec 06.
- `GET /api/trips/<uuid:id>/plan/` endpoint → spec 06.
- Adapter that calls `plan_logs` from `services.plan_trip` → spec 06.
- Leaflet map renderer → spec 07.
- §395.8 Daily Log SVG renderer → spec 08.
- PDF export → spec 09.
- §395.1(g) split-sleeper pairing options 2 & 3 → future spec (decision 9).
- Driver-profile timezone → future spec (decision 10).
- Driver chooses NOT to restart on cycle-cap → future spec (decision 8).
- Pre-trip / post-trip inspection events → out of v1 per decision 7.
- 60/7 cycle mode → out of v1.
- §395.1(b) adverse-conditions extension → out of v1.
- Hazmat, personal conveyance, yard moves, short-haul exception → already deferred per `context/project-overview.md`.
- `apps/web-app`, `apps/web-auth`, `packages/**` — untouched.

## Open questions

None blocking at write time. Three known-unknowns documented for the implementer; resolve inline + record in `progress-tracker.md` if encountered:

- **`Decimal`/`float` determinism: contract is minute-aligned durations.** (Pre-implementation architect-review finding m2 tightened this from an open question into a contract.) All emitted `LogEvent.duration` values are integer minutes — every duration the planner constructs is `timedelta(minutes=N)` or `timedelta(hours=N)` (driving legs round to whole minutes; pickup/dropoff are 60 min exact; fuel stops are 15 min exact; breaks are 30 min exact; off-duty blocks are 600 / 2040 min exact). The float `total_seconds()` is therefore exact in IEEE 754, and `Decimal(str(seconds))` round-trips deterministically across all Python 3.13.x patch versions. `test_planner_goldens.py` asserts `all(event.duration.total_seconds() % 60 == 0 for event in events)` as the contract. If a future change ever needs sub-minute durations (it shouldn't — §395.8 RODS grids are quarter-hour-granular), revisit the contract and add `Decimal.quantize(Decimal("0.000001"))` discipline at every Decimal/float boundary.

- **ORS polyline density variance.** ORS emits a polyline vertex every ~20m on highways, ~5m on tight curves. A trip with poor GPS coverage might emit < 100 vertices for a 1000-mile leg, making "nearest vertex to threshold T" less accurate. The 5% sanity check in `fuel_stop_indices` catches the extreme case. If sub-100-vertex legs surface in real traffic, add a per-vertex `cumulative_mi` interpolation that lands the fuel stop at a synthesized point along the segment between two adjacent vertices. v1 ships without this; the goldens use synthesized polylines with realistic density (one vertex every ~5 mi).

- **DST-boundary trips not exercised by any golden.** Per decision 13, all four goldens use `2024-04-15` (clean EDT, well past the 2024-03-10 DST transition). Trips that START on a DST-transition day (e.g., `2024-03-10 06:00`) — or trips long enough to span the November "fall back" — are not exercised. The §395.8 home-terminal-TZ rule (decision 10) means the planner emits events with monotonically increasing wall-clock time even across the DST jump; `timedelta` arithmetic ignores DST entirely. If a real driver reports "my log says I drove 13 hours but my watch says 12," document the DST convention in `README.md` and add a golden for the transition day.
