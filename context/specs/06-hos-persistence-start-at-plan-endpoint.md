# 06 — HOS persistence + `start_at` + plan endpoint

> Materialize the spec-05 `list[LogEvent]` into Postgres via three new tables (`trip_stops`, `log_events`, `log_days`), expose `GET /api/trips/<uuid:id>/plan/`, and add `start_at: datetime` to `Trip` + the trip-input form so drivers pick their shift start time the way Waze / Google Maps users pick departure time. The HOS planner from spec 05 is wired into the existing `services.plan_trip` pipeline via a thin adapter (`web_api/apps/trips/hos_adapter.py`) that imports `web_api.hos`, never the reverse — invariant #1 from `context/architecture.md` stays load-bearing. The plan-creation path becomes single-shot atomic: route resolution, HOS planning, and three-table persistence all live inside one `transaction.atomic()` block so the invariant "a Trip row exists ⇔ it has a valid plan" holds end-to-end. Leaflet ships in spec 07.

## Goal

Close the planner → API → form loop. After this spec ships, a signed-in driver submits the trip form (now with a `start_at` picker), the BE runs ORS + the HOS planner + persists the full plan, and `GET /api/trips/<id>/plan/` returns the ordered `LogEvent[]` + `TripStop[]` + `LogDay[]` that spec 07 will render on the map and spec 08 will draw on §395.8 grids. No FE map yet; this spec ships persistence + endpoint + form addition.

Five user-visible additions:

1. **`start_at` field on the trip form.** New `<input type="datetime-local">` inside a shadcn `Field`, default = "now rounded up to next 15 min" in the browser's local TZ, displayed and submitted as a `datetime` with offset. Validation: the value must be ≥ now − 5 min (drivers should not log past trips through this surface). zod-checked at submit; visible error via `data-invalid` on the `Field`.
2. **`Trip.start_at` column** persisted; the BE serializes it back on every Trip response so the FE can display "Departs at 2024-04-15 06:00 EDT" alongside the existing route summary.
3. **Plan auto-generated inside `POST /api/trips/`.** The existing pipeline already validated the route via ORS before persisting; spec 06 extends it: route validated → `Trip` row inserted → adapter calls `plan_logs(...)` → `TripStop` + `LogEvent` + `LogDay` rows inserted in the SAME `transaction.atomic()` block → 201 returned with the saved `Trip`. On any failure (ORS reject, planner raise, DB constraint), the entire transaction rolls back; no Trip row exists, no half-resolved plan persists.
4. **`GET /api/trips/<uuid:id>/plan/`** returns the composed plan: `{ "trip_id": …, "start_at": …, "stops": TripStop[], "events": LogEvent[], "days": LogDay[] }`. `IsAuthenticated`; ownership-gated (404 on missing or foreign — matches the spec-04 `TripRetrieveView` pattern).
5. **`TripDetailPanel` Route group gains a "Departs at" line** — single-line `font-mono text-sm` showing the saved `start_at` formatted via the browser's `Intl.DateTimeFormat` with the `home_terminal_tz` (`America/New_York` v1; future driver-profile spec replaces). Renders below the existing distance/duration line. No second card — same SidebarGroup as spec 04.

Architecture invariants from `context/architecture.md` hold: #1 (HOS planner pure — the adapter imports `web_api.hos`, never the inverse; the boundary test from spec 05 still passes verbatim), #2 (every duty-status change writes a `LogEvent` row), #3 (no raw ORS calls from browser), #4 (no client-side HOS math — the FE renders persisted rows), #5 (mutations + retrievals ownership-checked), #7 (semantic tokens only on the new form field), #9 (specs drive implementation).

## Decisions of record (resolved at planning time)

Pre-resolved during the spec-05/06/07 planning session and recorded here so the implementer doesn't re-litigate and senior review can audit. Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-temporal-coral.md`.

**Backend**

1. **Three new tables, all FK on `Trip` with `on_delete=CASCADE`.** Per `context/architecture.md#Storage Model` ("trip_stops, log_events, log_days — land with spec 06+ once the HOS planner exists"). The tables sit beside `Trip` in `web_api/apps/trips/models.py`; no new Django app is created (the HOS planner is NOT a Django app — it's the pure-Python module from spec 05). Same models.py as Trip + TripRouteCache; the adapter glue lives in a sibling `hos_adapter.py`.

2. **`TripStop`, `LogEvent`, `LogDay` schemas** (additive migration 0004 — no changes to `Trip`'s existing columns beyond `start_at`):

   ```python
   class TripStop(models.Model):
       id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
       trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="stops")
       kind = models.CharField(max_length=16, choices=StopKind.choices)
       sequence = models.PositiveSmallIntegerField()
       polyline_index = models.PositiveIntegerField()
       lat = models.DecimalField(max_digits=9, decimal_places=6)
       lon = models.DecimalField(max_digits=9, decimal_places=6)
       label = models.CharField(max_length=128, blank=True)
       scheduled_at = models.DateTimeField()
       duration_s = models.PositiveIntegerField()

       class Meta:
           indexes = [models.Index(fields=["trip", "sequence"])]
           constraints = [models.UniqueConstraint(fields=["trip", "sequence"], name="unique_trip_stop_seq")]
           ordering = ("trip", "sequence")

   class LogEvent(models.Model):
       id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
       trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="log_events")
       sequence = models.PositiveSmallIntegerField()
       status = models.CharField(max_length=32, choices=DutyStatusChoices.choices)  # 32 not 24: gives ~12 chars of slack for future §395.8 enum values (per architect-review m3)
       start = models.DateTimeField()
       duration_s = models.PositiveIntegerField()
       location = models.CharField(max_length=128)
       note = models.CharField(max_length=255, blank=True)

       class Meta:
           indexes = [
               models.Index(fields=["trip", "sequence"]),
               models.Index(fields=["trip", "start"]),
           ]
           constraints = [models.UniqueConstraint(fields=["trip", "sequence"], name="unique_trip_log_event_seq")]
           ordering = ("trip", "sequence")

   class LogDay(models.Model):
       id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
       trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="log_days")
       date = models.DateField()
       off_duty_s = models.PositiveIntegerField()
       sleeper_s = models.PositiveIntegerField()
       driving_s = models.PositiveIntegerField()
       on_duty_not_driving_s = models.PositiveIntegerField()
       total_miles = models.DecimalField(max_digits=7, decimal_places=1)

       class Meta:
           indexes = [models.Index(fields=["trip", "date"])]
           constraints = [models.UniqueConstraint(fields=["trip", "date"], name="unique_trip_log_day_date")]
           ordering = ("trip", "date")
   ```

   Enums:
   - `StopKind(TextChoices)`: `PICKUP / DROPOFF / FUEL / BREAK / SLEEPER / RESTART`. Declared in `models.py`.
   - `DutyStatusChoices(TextChoices)`: mirrors `web_api.hos.types.DutyStatus` (`OFF_DUTY / SLEEPER_BERTH / DRIVING / ON_DUTY_NOT_DRIVING`). Mirroring (not importing) is deliberate — see decision 3 below.

   **`TripStop.scheduled_at` / `TripStop.duration_s` derivation rule** (pre-implementation architect-review finding m7). The adapter populates these from the planner-emitted `LogEvent` whose status transitions to `ON_DUTY_NOT_DRIVING` (or `SLEEPER_BERTH` for `StopKind.SLEEPER`, `OFF_DUTY` for `StopKind.RESTART`) at the stop location. Concretely: `TripStop.scheduled_at = log_event.start`, `TripStop.duration_s = int(log_event.duration.total_seconds())`. Every `TripStop` row has exactly one originating `LogEvent`; the mapping is `_stop_kind_from_event(log_event) -> Optional[StopKind]` in the adapter (returns `None` for events that don't correspond to a stop, e.g., a 30-min `apply_break` event mid-leg — wait, breaks ARE stops per the brief's stop semantics; see the StopKind enum). The unit test `test_hos_adapter.py::test_stop_scheduled_at_matches_originating_event_start` locks the contract.

3. **`LogEvent.status` mirrors `DutyStatus.choices`, not re-imports.** The Django model's `choices=` list is a `TextChoices` subclass `DutyStatusChoices` declared inline in `models.py`, NOT a direct `choices=DutyStatus.choices` import from `web_api.hos.types`. Reason: importing `web_api.hos.types` at `models.py` module load is allowed (`types.py` is pure-Python and has no Django coupling), but mirroring keeps the model layer's enum surface owned by Django (so future migrations don't depend on a non-Django source). The adapter (decision 4) is responsible for the translation `DutyStatus.OFF_DUTY → DutyStatusChoices.OFF_DUTY` via the `.value` string. Adding a new duty-status value requires updating BOTH `web_api.hos.types.DutyStatus` AND `web_api.apps.trips.models.DutyStatusChoices` AND a migration — a deliberate friction point, documented in the model class docstring.

   **Enum-parity check runs in the spec-05 boundary test module so it shares fate with the planner's import-boundary gate** (pre-implementation architect-review finding m4). Co-locating the parity assertion in `apps/web-api/tests/hos/test_boundary.py` (which already runs on every push and on `pytest --affected` mode when ANY spec-05-touching file changes) means a planner-side enum addition cannot ship without a matching `DutyStatusChoices` update — the test fails CI before the migration history diverges. Implementation: an additional test function `test_duty_status_parity_with_django_choices` in the spec-05 boundary file. (Note: this requires the test to import the Django-side `DutyStatusChoices`, which forces `django.setup()` in that test module — acceptable per spec-05 decision on conftest inheritance.)

4. **`web_api/apps/trips/hos_adapter.py` is the SINGLE boundary** between the Django ORM and the pure-Python HOS planner. Imports allowed: stdlib, Django, DRF, `web_api.hos` (read-only — only consumes `plan_logs`, `PlannerInputs`, `LogEvent`, `DutyStatus`, `FuelStop`). The inverse — `web_api.hos.*` importing the adapter or any Django symbol — stays forbidden by invariant #1 and the spec-05 boundary test. Function signature:

   ```python
   def materialize_plan(trip: Trip) -> None:
       """Run the HOS planner against a saved Trip and persist the result.

       Called from inside services.plan_trip's existing transaction.atomic()
       block. Reads trip.route_polyline / trip.route_segments / trip.start_at /
       trip.cycle_hours_used; emits TripStop / LogEvent / LogDay rows via
       bulk_create. Any exception bubbles up; the caller's atomic() rolls back
       the entire transaction including the Trip insert.

       Single-shot contract: calling materialize_plan more than once per Trip
       raises IntegrityError on the sequence unique constraints (unique_trip_
       stop_seq / unique_trip_log_event_seq / unique_trip_log_day_date). Re-
       planning lives in a future spec (per progress-tracker.md Next Up).

       Per invariant #1 (architecture.md): this module imports web_api.hos but
       web_api.hos does NOT import this module. The boundary is one-way.
       """
   ```

   `materialize_plan` is the only public callable; everything else (the `LogEvent[] → LogDay[]` denormalization, the `DutyStatus → DutyStatusChoices` translation, the `FuelStop`/pickup/dropoff → `TripStop` mapping) is `_`-prefixed internal helpers. (Single-shot idempotency contract added per pre-implementation architect-review finding m2.)

5. **`LogDay` is denormalized at write time, with midnight-crossing events split per-day.** The adapter iterates the `LogEvent[]` once and buckets by `start.astimezone(home_terminal_tz).date()`. Per §395.8 / `docs/interstate-truck-driver-guide.md:176`, the home-terminal TZ is the canonical clock for the §395.8 grid; the LogDay's `date` field is the home-terminal-local date. Spec 08 (SVG renderer) reads `LogDay` rows for the header totals; computing them lazily would force a join + aggregate on every render — denormalize once at write.

   **Midnight-crossing events split per-day** (pre-implementation architect-review finding m1). A single `LogEvent` whose `[start, start+duration)` interval spans a home-terminal midnight is **persisted as one row** (invariant #2: every duty-status change writes a row, and the change happens once), but its seconds are **attributed split-by-fragment** across the relevant `LogDay` rows. Concretely: for a 5h `DRIVING` event from 22:00 → 03:00 the next day, the day-1 `LogDay.driving_s` gets 2h (22:00 → 24:00) and the day-2 `LogDay.driving_s` gets 3h (00:00 → 03:00). The `LogEvent` row itself is the single 5h block; spec 08's SVG renderer redraws the line on the next day's grid by reading the same `LogEvent` and intersecting it with the day boundary. The adapter helper `_attribute_to_days(events, tz) -> dict[date, dict[str, int]]` performs the split.

   The driving-miles attribution for each day uses the same fragmentation: a `DRIVING` event's `cum_miles` delta is allocated proportionally to its time fragments across days (`miles_day1 = delta * (seconds_in_day1 / total_seconds)`). Pickup / dropoff / fuel / break / off-duty events contribute zero miles to the day total. Total-miles attribution test: `test_hos_adapter.py::test_midnight_crossing_drive_splits_miles_proportionally`.

6. **`plan_trip` is the only insertion path; no separate "create stop / event" service.** Per `context/code-standards.md` ("Validate at the boundary, trust inside") + decision 4 above, the plan_trip pipeline is the single point where a Trip becomes "complete" (with its route, stops, log events, log days). There is no `services.create_trip_stop()` or `services.create_log_event()` — that would invite drift where someone wires a future endpoint to write rows outside the transaction. The plan_trip pipeline is extended in-place:

   ```python
   def plan_trip(serializer_data: Mapping[str, Any], user_id: str) -> Trip:
       coords = _extract_coords(serializer_data)
       directions = _resolve_directions(coords)  # cache lookup + ORS call, may raise OrsError
       with transaction.atomic():
           trip = Trip.objects.create(
               user_id=user_id,
               **_trip_address_fields(serializer_data),
               cycle_hours_used=serializer_data["cycle_hours_used"],
               start_at=serializer_data["start_at"],
               route_polyline=directions.polyline,
               route_segments=[dataclasses.asdict(s) for s in directions.segments],
               route_summary=dataclasses.asdict(directions.summary),
           )
           hos_adapter.materialize_plan(trip)  # raises on planner failure
       return trip
   ```

   `materialize_plan` is called INSIDE the atomic block, after the Trip insert. If `materialize_plan` raises (ValueError from `PlannerInputs.__post_init__`, ValueError from `fuel_stop_indices` if the ORS summary contradicts the polyline cumulative, or any other planner-level fault), the transaction rolls back and the view layer returns 422 (the routing succeeded but the planner refused the inputs) with the project envelope. The single-shot atomic is mandatory: a half-persisted Trip with no plan rows would violate invariant #2 (every duty-status change writes a LogEvent).

7. **Plan-endpoint response envelope.** `GET /api/trips/<uuid:id>/plan/` (`IsAuthenticated`, ownership-gated, throttled at `trip_plan_retrieve = 120/min`):

   ```json
   {
     "trip_id": "uuid",
     "start_at": "2024-04-15T06:00:00-04:00",
     "home_terminal_tz": "America/New_York",
     "stops": [
       {
         "id": "uuid",
         "kind": "pickup",
         "sequence": 0,
         "polyline_index": 142,
         "lat": "38.303200",
         "lon": "-77.460500",
         "label": "",
         "scheduled_at": "2024-04-15T07:12:00-04:00",
         "duration_s": 3600
       }
     ],
     "events": [
       {
         "id": "uuid",
         "sequence": 0,
         "status": "driving",
         "start": "2024-04-15T06:00:00-04:00",
         "duration_s": 4320,
         "location": "37.540700, -77.436000",
         "note": ""
       }
     ],
     "days": [
       {
         "id": "uuid",
         "date": "2024-04-15",
         "off_duty_s": 0,
         "sleeper_s": 0,
         "driving_s": 22680,
         "on_duty_not_driving_s": 7200,
         "total_miles": "342.7"
       }
     ]
   }
   ```

   All durations in seconds. Timestamps as ISO 8601 with offset. `lat` / `lon` / `total_miles` as JSON strings (`DecimalField` → DRF default emits as string to avoid float coercion). No pagination — every Trip's plan is bounded (≤100 events even for transcontinental trips per spec 05's golden expectations).

8. **`Trip.start_at` is required and non-null.** Migration 0004 adds the column with `null=False`; the migration includes a `RunPython` that sets `start_at = created_at` for any existing rows (the spec-04 + spec-03 local-dev rows from the running Postgres `outbound_dev`). The reverse `RunPython` sets `start_at = NULL` before the `RemoveField` step. `start_at` is added to `TripCreateRequestSerializer.required_fields` so any FE that doesn't send it gets a 400 — the form addition (decision 11) ensures this never happens in practice, but the contract is enforced at the serializer layer.

9. **`TripCreateRequestSerializer` accepts `start_at` as ISO 8601 with offset.** DRF's `DateTimeField` accepts ISO 8601 by default with offset OR `Z`. The serializer rejects naive datetimes — `format='iso-8601'` plus a **callable** field-level validator that calls `timezone.now()` fresh per request. **`MinValueValidator(timezone.now() - timedelta(minutes=5))` is forbidden** — that expression evaluates at class-definition (worker boot) time, so the cutoff would progressively recede as the worker runs (pre-implementation architect-review finding M1). Correct shape:

   ```python
   from datetime import timedelta
   from django.utils import timezone
   from rest_framework import serializers

   _PAST_SLACK = timedelta(minutes=5)

   def _validate_start_at_not_past(value: datetime) -> None:
       if value < timezone.now() - _PAST_SLACK:
           raise serializers.ValidationError("start_at cannot be in the past.")

   class TripCreateRequestSerializer(serializers.Serializer):
       start_at = serializers.DateTimeField(validators=[_validate_start_at_not_past])
   ```

   The closure-over-`timezone.now` reads fresh each call. The 5-min slack is the same FE / BE boundary; the FE validates against `Date.now() - 5 min` zod-side and the BE re-validates against `timezone.now() - 5 min` at request time. A unit test (`test_trip_pipeline.py::test_start_at_past_rejected_at_request_time`) freezes `timezone.now()` via `freezegun` to confirm the validator reads the current time on each call, not a stale boot-time value.

10. **Throttle for `TripPlanView`** under `trip_plan_retrieve = 120/min` per Clerk user. Reads are cheap (one query + serializer); 120/min is generous enough that the FE can poll-refresh on tab focus without hitting it. The existing `PerUserScopedThrottle` from spec 04 is reused — only the rate string + the `throttle_scope` attribute on the view are new.

**Frontend**

11. **`start-at-field.tsx` ships in `apps/web-app/src/features/trip-planner/components/`.** Composes:
    - shadcn `Field` + `FieldLabel` + `FieldControl` + `FieldDescription` + `FieldError`.
    - Inner control: `<input type="datetime-local" />` with `min={nowRoundedUpTo15Min()}`. `step={900}` (15-min increments).
    - `data-invalid={fieldState.invalid ? "true" : undefined}` mirrored on the inner input.
    - Default value: `nowRoundedUpTo15Min()` computed at form-mount via `useMemo(() => roundUpToNext15Min(new Date()), [])`. Submitted as ISO 8601 with the browser's local offset via `.toISOString()` on a `Date` that already has the offset baked.
    - Helper `roundUpToNext15Min(date: Date): Date` lives in `utils/round-time.ts` (pure function, unit-tested). Rounds to the next quarter-hour boundary (e.g., 10:07 → 10:15, 10:15 → 10:30).

12. **NO global "now" reach.** The default value is computed ONCE at form-mount via `useMemo`. The component does NOT recompute every render (which would flicker the default value every second). If the form is mounted, abandoned, and re-mounted, a fresh default fires — acceptable. No `setInterval` ticker.

13. **`trip-input.ts` zod schema** extends with `start_at: z.string().datetime({ offset: true })` (the `datetime({ offset: true })` variant requires an offset; rejects `Z`-only / naive forms — matches BE expectation). A refinement asserts `new Date(start_at).valueOf() >= Date.now() - 5*60_000` (the same 5-min slack as the BE). Refinement message: `"Start time cannot be in the past."`.

14. **`TripDetailPanel` Route SidebarGroup** gains one more line (`<dt>Departs</dt><dd>{formattedStartAt}</dd>`). `formattedStartAt` is `new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(trip.start_at))`. The `timeZone` is hardcoded to `America/New_York` matching the BE's `home_terminal_tz` constant (decision 10 of spec 05). When the driver-profile-TZ spec ships, this becomes `trip.home_terminal_tz`. No icon decoration; `<dt>` / `<dd>` semantics carry meaning per `context/ui-context.md` density rules.

15. **NO plan-fetching hook in spec 06.** `GET /api/trips/<id>/plan/` exists on the BE, but the FE does NOT call it. Spec 07's Leaflet renderer is the first consumer; the FE-side TanStack Query hook + zod schema for the plan response ship with spec 07. This spec stays at the BE-endpoint-plus-form-field boundary; the FE work is limited to the `start_at` picker + display. Justification: shipping a hook that no UI consumes is the "no unused exports" anti-pattern from `context/code-standards.md`.

16. **MSW handler updates — `start_at` only; plan handler defers to spec 07.** `apps/web-app/src/testing/handlers.ts` extends `mockTripPlanned` to include `start_at: "2024-04-15T06:00:00-04:00"` in the default trip shape. **No `mockTripPlanInline` handler ships in spec 06.** (Pre-implementation architect-review finding m6: shipping an unused mock handler contradicts anti-pattern #10 below — and spec 07 will need a fresh handler against the final-final response shape anyway.) Spec 07 authors the plan-handler with its consumer.

## Decisions amended post-implementation

Filled in if/when live-test surfaces a behavior the spec did not anticipate. Empty at write time.

## Scope

### In

**`apps/web-api` — models, migration, adapter, services, view, serializers:**

- `web_api/apps/trips/models.py` — add `StopKind(TextChoices)`, `DutyStatusChoices(TextChoices)`, `TripStop`, `LogEvent`, `LogDay`. Extend `Trip` with `start_at: DateTimeField(null=False)`.
- `web_api/apps/trips/migrations/0004_start_at_and_plan_tables.py` (NEW — generated by `makemigrations` + `RunPython` for `start_at = created_at` backfill on existing rows).
- `web_api/apps/trips/hos_adapter.py` (NEW) — `materialize_plan(trip: Trip) -> None`. Internal helpers `_build_planner_inputs`, `_emit_trip_stops`, `_emit_log_events`, `_emit_log_days`, `_duty_status_to_choices`. Imports `web_api.hos` symbols only.
- `web_api/apps/trips/services.py` — `plan_trip` extends per decision 6 (atomic block now wraps both the Trip insert AND `materialize_plan`).
- `web_api/apps/trips/serializers.py` — extend `TripResponseSerializer` with `start_at`; extend `TripCreateRequestSerializer` with `start_at` (required, ISO 8601 with offset, `MinValueValidator(now - 5 min)`). Add `TripStopSerializer`, `LogEventSerializer`, `LogDaySerializer`, `TripPlanSerializer` (composed: stops, events, days under one envelope).
- `web_api/apps/trips/views.py` — `TripCreateView` unchanged (delegates to `plan_trip` as before). Add `TripPlanView(RetrieveAPIView)` — `lookup_field = "id"`, `permission_classes = [IsAuthenticated]`, `throttle_scope = "trip_plan_retrieve"`, ownership-gated via `get_queryset` filtering on `request.user_id` (404 on missing or foreign — same pattern as `TripRetrieveView`).
- `web_api/apps/trips/urls.py` — wire `GET /api/trips/<uuid:id>/plan/`.
- `web_api/settings/base.py` — `DEFAULT_THROTTLE_RATES["trip_plan_retrieve"] = "120/min"`.

**`apps/web-app` — form field, schema, panel update, helper, MSW:**

- `features/trip-planner/components/start-at-field.tsx` (NEW) — the datetime picker.
- `features/trip-planner/components/trip-input-form.tsx` — mount `<StartAtField />` below `<CycleHoursField />`.
- `features/trip-planner/components/trip-detail-panel.tsx` — add the "Departs" `<dt>`/`<dd>` line in the Route SidebarGroup.
- `features/trip-planner/schemas/trip-input.ts` — `start_at: z.string().datetime({ offset: true })` + `now - 5min` refinement.
- `features/trip-planner/schemas/trip-response.ts` — `start_at: z.string().datetime({ offset: true })`.
- `features/trip-planner/utils/round-time.ts` (NEW) — `roundUpToNext15Min(date: Date): Date`.
- `features/trip-planner/utils/format-start-at.ts` (NEW) — `formatStartAt(iso: string, timeZone: string): string` using `Intl.DateTimeFormat`. Pure function.
- `testing/handlers.ts` — extend `mockTripPlanned` with `start_at`. (No plan-endpoint mock handler — defers to spec 07 with its FE consumer; per architect-review m6.)

**Tests (mandatory minimum):**

- `apps/web-api/tests/trips/test_models_plan.py` (NEW) — TripStop / LogEvent / LogDay constraints (unique sequence per trip, sequence non-negative, cascade delete from Trip).
- `apps/web-api/tests/trips/test_hos_adapter.py` (NEW) — `materialize_plan` against a fixture Trip with synthesized `route_polyline` / `route_segments` / `route_summary`; mock `web_api.hos.plan_logs` to return a canned `list[LogEvent]`; assert the row counts + LogDay totals + DutyStatus → DutyStatusChoices translation. Also asserts `web_api.hos.types.DutyStatus.__members__.keys() == DutyStatusChoices.__members__.keys()` (enum-parity test).
- `apps/web-api/tests/trips/test_trip_plan_view.py` (NEW) — `GET /api/trips/<id>/plan/`: 200 on own; 404 on missing; 404 on foreign (no oracle); 401 on unauthenticated; throttle exhaustion → 429.
- `apps/web-api/tests/trips/test_trip_pipeline.py` — extend with: `start_at` in the request body round-trips through; `materialize_plan` raise → the entire transaction rolls back (no Trip row, no plan rows); `materialize_plan` success → all three table row counts match the planner output.
- `apps/web-app/src/features/trip-planner/components/start-at-field.test.tsx` (NEW) — renders; default value rounds up correctly; submitting a past value shows the zod error; `data-invalid` mirrors `aria-invalid`.
- `apps/web-app/src/features/trip-planner/utils/round-time.test.ts` (NEW) — pure-function tests for the rounding helper.
- `apps/web-app/src/features/trip-planner/utils/format-start-at.test.ts` (NEW) — pure-function tests for the formatter.
- `apps/web-app/src/features/trip-planner/components/trip-detail-panel.test.tsx` — extend with the "Departs" `<dt>`/`<dd>` assertion.
- `apps/web-app/src/features/trip-planner/components/trip-input-form.test.tsx` — extend with the `start_at` field present + zod validation flow.

### Out (deferred to listed specs)

- **Leaflet map renderer** → spec 07. The plan endpoint is unconsumed by the FE in spec 06; spec 07 wires the TanStack Query hook.
- **§395.8 Daily Log SVG renderer** → spec 08.
- **PDF export** → spec 09.
- **Driver-profile timezone** → future spec (replaces the hard-coded `America/New_York` in `services.plan_trip` + `TripDetailPanel`).
- **Re-plan on `start_at` edit** → future spec. v1's `start_at` is immutable post-creation; editing requires creating a new trip.
- **§395.1(g) split-sleeper pairing options 2 & 3** → future spec (per spec 05 decision 9).
- **Reverse-geocoded location labels on `TripStop` / `LogEvent`** → future spec (per spec 05 open question). `TripStop.label` is empty in v1; `LogEvent.location` is `"lat, lon"` per spec 05.
- **Plan SVG render or alternative output formats** → future spec. The plan endpoint emits JSON only.

## Prerequisites (already true)

- Spec 04 is merged on `develop`. `Trip` ships with `route_polyline / route_segments / route_summary`; `services.plan_trip` exists and is atomic; `TripRouteCache` exists; `PerUserScopedThrottle` exists keyed on `request.user_id`.
- Spec 05 is merged on `develop` (this spec's prerequisite — the implementer must wait for the spec 05 PR to merge before spec 06 implementation begins). `web_api.hos.plan_logs(PlannerInputs) -> list[LogEvent]` ships and is golden-tested. `DutyStatus` enum is stable.
- The local Postgres role `outbound` + DB `outbound_dev` exist (spec 03 bootstrap); existing Trip rows have `created_at` populated, which the migration uses to backfill `start_at`.
- `apps/web-app` ships the spec-04 RouteSummary in `TripDetailPanel`'s Route SidebarGroup; `TripInputForm` exists with current/pickup/dropoff + cycle hours fields; `apiFetch<T>` + `ApiError` + the MSW harness exist.
- `packages/ui` already ships `Field`, `FieldLabel`, `FieldControl`, `FieldDescription`, `FieldError`, `Input`, `Sidebar`, `SidebarGroup` primitives. No new shadcn install.

## Boundary

- Touches `apps/web-api/web_api/{apps/trips/{models.py, services.py, hos_adapter.py, views.py, serializers.py, urls.py, migrations/0004_*}, settings/base.py}`.
- Touches `apps/web-app/src/features/trip-planner/{components/{start-at-field.tsx, trip-input-form.tsx, trip-detail-panel.tsx}, schemas/{trip-input.ts, trip-response.ts}, utils/{round-time.ts, format-start-at.ts}}` + colocated tests + `src/testing/handlers.ts`.
- Touches `context/{architecture.md, progress-tracker.md}` (post-implementation, last commits).
- Does **NOT** touch `apps/web-api/web_api/hos/**` (the planner is read-only here — spec 05 owns it; the boundary test from spec 05 still passes).
- Does **NOT** touch `apps/web-auth/**`, `packages/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.

**Boundary deviation — single FE+BE vertical slice for the `start_at` field.** `context/ai-workflow-rules.md#Scoping rules` says split FE/BE into ordered units. Spec 06 deviates because: (a) shipping the BE `start_at` column without a FE picker leaves the form rejecting all submissions (the new BE field is required); (b) shipping the FE picker without the BE column rejects every submission too; (c) splitting into "form-only" + "BE-only" creates two no-user-value intermediate specs (the form sends a field the BE ignores, OR the BE expects a field the form doesn't send). Same precedent as specs 03 / 04. Recorded inline for senior-review traceability. The plan endpoint (BE-only) does ship without an FE consumer per decision 15 — that's a different boundary call, justified separately: the endpoint is the contract for spec 07, and shipping it now (with tests) tightens the hand-off.

## Sequencing

Order matters: models + migration land first so the adapter can reference them; the adapter lands second so `plan_trip` can call it; the view lands third; the FE form addition lands fourth (it depends on the BE accepting `start_at`).

### Step 1 — BE: models + migration

1. Edit `web_api/apps/trips/models.py`:
   - Add `class StopKind(models.TextChoices)` with `PICKUP / DROPOFF / FUEL / BREAK / SLEEPER / RESTART`.
   - Add `class DutyStatusChoices(models.TextChoices)` mirroring `web_api.hos.types.DutyStatus`.
   - Add `TripStop`, `LogEvent`, `LogDay` per decision 2.
   - Extend `Trip` with `start_at = models.DateTimeField(null=False)`.
2. `uv run python manage.py makemigrations trips`. Inspect the generated migration:
   - The `AddField` for `start_at` must come BEFORE the `RunPython` backfill (the field must exist when the backfill runs).
   - The `RunPython` backfills `start_at = created_at` for existing rows:

     ```python
     def forward_backfill_start_at(apps, schema_editor):
         Trip = apps.get_model("trips", "Trip")
         Trip.objects.filter(start_at__isnull=True).update(start_at=models.F("created_at"))

     def reverse_clear_start_at(apps, schema_editor):
         Trip = apps.get_model("trips", "Trip")
         Trip.objects.update(start_at=None)
     ```

     Migration order matters (per spec 04 decision 9 precedent): `AddField start_at (nullable temporarily) → RunPython backfill → AlterField start_at (null=False) → CreateModel TripStop / LogEvent / LogDay`. The `AlterField` step is needed because the column must initially be nullable to allow the `AddField` to land on an existing table without a `DEFAULT`; once backfilled, the `AlterField null=False` locks the contract.

3. `uv run python manage.py migrate`. Verify on the local Postgres that any spec-03/04 row's `start_at` is set to its `created_at`.

### Step 2 — BE: `hos_adapter.py`

1. Create `web_api/apps/trips/hos_adapter.py`. Module docstring restates the invariant-#1 one-way-boundary rule (decision 4) and cites `context/architecture.md`. Imports allowed: `dataclasses`, `datetime`, `decimal`, `typing`, `zoneinfo`, Django ORM bits, `web_api.hos` (read-only).
2. Implement `materialize_plan(trip: Trip) -> None`:
   - `_build_planner_inputs(trip) -> PlannerInputs` — reconstructs `DirectionsResult` from the trip's persisted `route_polyline / route_segments / route_summary` JSON columns, sets `cycle_hours_used = trip.cycle_hours_used`, `start_at = trip.start_at`, `home_terminal_tz = ZoneInfo("America/New_York")` (decision 10 of spec 05).
   - `events = plan_logs(inputs)` — call the spec-05 planner.
   - `_emit_trip_stops(trip, events, fuel_stops)` — derive `TripStop` rows from the events + fuel-stop indices.
   - `_emit_log_events(trip, events)` — translate `web_api.hos.types.LogEvent` dataclasses → `web_api.apps.trips.models.LogEvent` rows via `bulk_create`.
   - `_emit_log_days(trip, events)` — bucket events by home-terminal date, compute per-status sums, emit `LogDay` rows via `bulk_create`.
3. `tests/trips/test_hos_adapter.py`:
   - Mock `web_api.hos.plan_logs` to return a canned `list[LogEvent]` (3 events: pickup on-duty, drive, dropoff on-duty).
   - Assert: 1 TripStop (pickup) + 1 TripStop (dropoff) emitted; 3 LogEvent rows emitted; 1 LogDay row emitted with correct per-status totals.
   - Enum parity: assert `set(DutyStatusChoices.__members__) == set(DutyStatus.__members__)`.

### Step 3 — BE: extend `plan_trip` + view + serializers

1. Edit `web_api/apps/trips/services.py::plan_trip`:
   - Add `start_at = serializer_data["start_at"]` to the `Trip.objects.create` kwargs.
   - Inside the existing `transaction.atomic()` block, after the Trip insert, call `hos_adapter.materialize_plan(trip)`.
2. Edit `serializers.py`:
   - Extend `TripCreateRequestSerializer.Meta.fields` with `"start_at"`.
   - Add `start_at` field declaration with `format="iso-8601"` + the `now - 5 min` `MinValueValidator`.
   - Extend `TripResponseSerializer.Meta.fields` with `"start_at"`.
   - Add `TripStopSerializer(serializers.ModelSerializer)`, `LogEventSerializer(serializers.ModelSerializer)`, `LogDaySerializer(serializers.ModelSerializer)`.
   - Add `TripPlanSerializer(serializers.Serializer)` composed: `trip_id`, `start_at`, `home_terminal_tz`, `stops` (list of stops), `events` (list of events), `days` (list of days).
3. Edit `views.py`:
   - Add `TripPlanView(RetrieveAPIView)` with `serializer_class = TripPlanSerializer`, `lookup_field = "id"`, `permission_classes = [IsAuthenticated]`, `throttle_scope = "trip_plan_retrieve"`.
   - `get_queryset` filters on `request.user_id` so a foreign user gets 404 (no oracle). The queryset prefetches the three related collections: `Trip.objects.filter(user_id=request.user_id).prefetch_related("stops", "log_events", "log_days")`. Without `prefetch_related`, the serializer issues N+3 queries per retrieve (pre-implementation architect-review finding M2).
   - **`get_object` returns the `Trip` instance** (DRF default; `RetrieveAPIView`'s `check_object_permissions` requires a model instance, not a dict). Composition into the envelope `{trip_id, start_at, home_terminal_tz, stops, events, days}` happens in `TripPlanSerializer.to_representation(self, trip)`, which reads `trip.stops.all()` / `trip.log_events.all()` / `trip.log_days.all()` (all prefetched — zero extra queries) and assembles the response shape. (Earlier spec draft had `get_object` return a dict — pre-implementation architect-review finding M2 caught the contract violation; fixed here.)
4. Edit `urls.py`: add `path("trips/<uuid:id>/plan/", TripPlanView.as_view(), name="trip-plan")`.
5. Edit `settings/base.py`: extend `DEFAULT_THROTTLE_RATES` with `"trip_plan_retrieve": "120/min"`.
6. `tests/trips/test_trip_plan_view.py`: 200 / 401 / 404-missing / 404-foreign / throttle exhaustion. Use the same `authenticated_client` + `TripFactory` from spec 04's `conftest.py`.

### Step 4 — FE: helpers + schemas

1. `apps/web-app/src/features/trip-planner/utils/round-time.ts`:

   ```ts
   export function roundUpToNext15Min(date: Date): Date {
     const ms = date.getTime();
     const quarterMs = 15 * 60 * 1000;
     return new Date(Math.ceil(ms / quarterMs) * quarterMs);
   }
   ```

   Unit-tested with: exactly on a quarter (no change), 1 ms past a quarter (rounds up to next), 14:59 (rounds to 15:00 next day's pivot if relevant — not relevant for the 15-min case but covered for clarity).

2. `apps/web-app/src/features/trip-planner/utils/format-start-at.ts`:

   ```ts
   const DEFAULT_FORMATTER = new Intl.DateTimeFormat("en-US", {
     dateStyle: "medium",
     timeStyle: "short",
     timeZone: "America/New_York",
   });

   export function formatStartAt(iso: string, timeZone = "America/New_York"): string {
     const date = new Date(iso);
     if (Number.isNaN(date.valueOf())) return "—";
     if (timeZone === "America/New_York") return DEFAULT_FORMATTER.format(date);
     return new Intl.DateTimeFormat("en-US", {
       dateStyle: "medium",
       timeStyle: "short",
       timeZone,
     }).format(date);
   }
   ```

   The default `Intl.DateTimeFormat` is cached at module scope for the common case (`America/New_York`); other TZs spin up a new formatter (cheap, but uncached in v1). The file carries a `// WHY: cached for the common-case TZ; tzdata staleness across DST transitions requires a tab reload, acceptable for v1` comment per pre-implementation architect-review finding m5.

3. `features/trip-planner/schemas/trip-input.ts` — extend the existing schema:

   ```ts
   import { z } from "zod";

   const PAST_SLACK_MS = 5 * 60 * 1000;

   export const tripInputSchema = z.object({
     // ... existing fields
     start_at: z
       .string()
       .datetime({ offset: true })
       .refine((iso) => new Date(iso).valueOf() >= Date.now() - PAST_SLACK_MS, {
         message: "Start time cannot be in the past.",
       }),
   });
   ```

4. `features/trip-planner/schemas/trip-response.ts` — extend with `start_at: z.string().datetime({ offset: true })`.

### Step 5 — FE: `start-at-field.tsx` + form mount

1. `start-at-field.tsx` per decision 11. Component signature: `function StartAtField()` — reads from the surrounding `useFormContext()`; emits the controlled input via `Controller`. No props.
2. Edit `trip-input-form.tsx`: mount `<StartAtField />` below the existing `<CycleHoursField />`. The shadcn `FieldGroup` ordering: `[CurrentAddressField, PickupAddressField, DropoffAddressField, CycleHoursField, StartAtField]`.
3. Edit `trip-detail-panel.tsx`: add the `<dt>Departs</dt><dd>{formatStartAt(trip.start_at)}</dd>` line in the Route SidebarGroup, below the existing distance/duration row. NO icon decoration (per spec 04 anti-pattern #7).

### Step 6 — FE: MSW + tests

1. Edit `testing/handlers.ts`:
   - `mockTripPlanned`: include `start_at: "2024-04-15T06:00:00-04:00"` in the default trip body.
   - No plan-endpoint mock handler ships here — defers to spec 07 (per decision 16 / architect-review m6).
2. Colocated Vitest specs per Scope §Tests. AAA structure; `getByRole` > `getByLabelText` > `getByText` > `getByTestId`; `userEvent` not `fireEvent`. The `start-at-field.test.tsx` mocks `Date.now()` via `vi.useFakeTimers()` so the rounding default is deterministic.

### Step 7 — Manual browser smoke

Run all three dev servers (same as spec 04):

```bash
cd apps/web-api && uv run python manage.py migrate && uv run python manage.py runserver 0.0.0.0:8000
pnpm --filter web-auth dev
pnpm --filter web-app dev
```

Browser walk:

1. Open `/trips/new`. Confirm the new datetime picker is present below the cycle-hours slider, defaulting to a time ≥ now rounded up to the next 15 min.
2. Submit the Richmond → Fredericksburg → Newark golden with default cycle hours; observe the 201 response includes `start_at`. Land on `/trips/:id`. Confirm the "Departs" line in the side panel shows the saved time formatted via `Intl.DateTimeFormat` in `America/New_York`.
3. Attempt to submit a past `start_at` (e.g., yesterday). Observe the FE `data-invalid` state on the Field; submit anyway via dev tools; observe the BE 400 with `{"detail": "start_at: …", "errors": {"start_at": [...]}}`.
4. `curl -H "Authorization: Bearer <jwt>" http://localhost:8000/api/trips/<id>/plan/`. Confirm the JSON envelope matches decision 7; row counts match the spec-05 golden expectations (the Richmond → Newark trip emits ~5 LogEvent rows + 2 TripStop rows + 1 LogDay row).
5. `curl ... /api/trips/<bogus-id>/plan/` → 404 (no oracle). `curl ... /api/trips/<foreign-id>/plan/` (with a JWT whose `sub` doesn't own the trip) → 404.
6. Mobile (375×667) + desktop (1440×900) screenshots in the PR body for the form with the new field + the detail panel with the new "Departs" line.

### Step 8 — Sub-agent passes

Run, in this order, against the diff (architect-review against the spec text fires BEFORE Step 1 begins — same precedent as spec 04 / spec 05):

1. `architect-review` (`comprehensive-review`) — **First, against the SPEC TEXT** before implementation begins. Then against the diff.
2. `code-reviewer` (`comprehensive-review`) — mandatory before PR.
3. `python-pro` + `django-pro` (`python-development`) — mandatory. Migration design (AlterField + RunPython order), `bulk_create` patterns, ORM hygiene (select_related on TripPlanView), enum mirroring.
4. `security-auditor` (`comprehensive-review`) — `TripPlanView` ownership gate (404 on foreign — no oracle), throttle config, `start_at` validator's clock-skew tolerance.
5. `typescript-pro` (`javascript-typescript`) — recommended. zod schema patterns, `Intl.DateTimeFormat` caching, controlled-input + react-hook-form composition.
6. `ui-visual-validator` (`accessibility-compliance`) — mandatory. New `<input type="datetime-local">` accessibility (label, error, `aria-invalid` mirror), the new "Departs" `<dt>`/`<dd>` line contrast and density, mobile layout for the form with the extra field, `prefers-reduced-motion` honored on any new animations (none expected, but verify).
7. `performance-engineer` (`application-performance`) — recommended. New endpoint + bulk_create write cost inside the critical path of trip creation; Trip plan response payload size for transcontinental trips (target < 50 KB).

### Step 9 — Tracker + architecture updates (last commits)

- `context/architecture.md`:
  - **Storage Model** — add `trip_stops`, `log_events`, `log_days` rows (PK + key columns + indexes + cascade) and document the LogDay denormalization rationale.
  - **External integrations / Rate limiting** — add the `trip_plan_retrieve = 120/min` row.
  - **Invariants #1, #2** — restate the adapter direction (decision 4) and the row-per-status-change rule (decision 6 / invariant #2).
- `context/progress-tracker.md` — record completion under `## Completed`; clear `## In Progress`; reshuffle `## Next Up` (spec 07 = Leaflet map; spec 08 = §395.8 SVG; spec 09 = PDF).

## File-level deliverables

```
apps/web-api/
└── web_api/
    ├── settings/base.py                                       # MODIFY: + DEFAULT_THROTTLE_RATES["trip_plan_retrieve"]
    └── apps/trips/
        ├── models.py                                          # MODIFY: + StopKind, DutyStatusChoices, TripStop, LogEvent, LogDay; + Trip.start_at
        ├── services.py                                        # MODIFY: + start_at on create; call hos_adapter.materialize_plan in atomic
        ├── hos_adapter.py                                     # NEW: materialize_plan + internal helpers; one-way import of web_api.hos
        ├── views.py                                           # MODIFY: + TripPlanView
        ├── serializers.py                                     # MODIFY: + start_at; + TripStop/LogEvent/LogDay/TripPlanSerializer
        ├── urls.py                                            # MODIFY: + GET /<uuid:id>/plan/
        └── migrations/0004_start_at_and_plan_tables.py        # NEW (generated + RunPython for start_at backfill)

apps/web-api/tests/trips/
├── test_models_plan.py                                        # NEW
├── test_hos_adapter.py                                        # NEW
├── test_trip_plan_view.py                                     # NEW
└── test_trip_pipeline.py                                      # MODIFY: + start_at round-trip + atomic-rollback-on-adapter-raise

apps/web-app/src/features/trip-planner/
├── components/
│   ├── start-at-field.tsx                                     # NEW
│   ├── start-at-field.test.tsx                                # NEW
│   ├── trip-input-form.tsx                                    # MODIFY: mount <StartAtField />
│   ├── trip-input-form.test.tsx                               # MODIFY: + start_at presence + zod refinement
│   ├── trip-detail-panel.tsx                                  # MODIFY: + "Departs" line
│   └── trip-detail-panel.test.tsx                             # MODIFY: + "Departs" line assertion
├── schemas/
│   ├── trip-input.ts                                          # MODIFY: + start_at
│   └── trip-response.ts                                       # MODIFY: + start_at
└── utils/
    ├── round-time.ts                                          # NEW
    ├── round-time.test.ts                                     # NEW
    ├── format-start-at.ts                                     # NEW
    └── format-start-at.test.ts                                # NEW

apps/web-app/src/testing/handlers.ts                           # MODIFY: + start_at on mockTripPlanned (plan-endpoint mock defers to spec 07)

context/
├── architecture.md                                            # MODIFY (post-implementation): + Storage Model rows, + invariant restates
└── progress-tracker.md                                        # MODIFY (post-implementation, LAST commit)
```

No `pyproject.toml` change. No `packages/ui` change. No new shadcn primitives. No new TS / Python dependencies.

## Existing functions / utilities to reuse (do not re-implement)

- `web_api.hos.plan_logs` / `PlannerInputs` / `LogEvent` / `DutyStatus` / `FuelStop` — spec 05's public surface. The adapter consumes; do NOT fork.
- `web_api.integrations.openrouteservice.DirectionsResult` / `DirectionsSegment` / `DirectionsSummary` — reconstructed inside the adapter from `Trip.route_*` JSON columns; do NOT call the real ORS again.
- `web_api/apps/trips/services.py::plan_trip` — extend in place; do NOT create a parallel pipeline.
- `web_api/throttling.py::PerUserScopedThrottle` — already keyed on `request.user_id`; only the rate config + the `throttle_scope` attribute on `TripPlanView` are new.
- `web_api/exception_handler.py::exception_handler` — the `{"detail", "errors"}` envelope.
- `web_api/auth/authentication.py::ClerkAuthentication` — already sets `request.user_id`.
- `apps/web-app/src/lib/api-client.ts::apiFetch` + `ApiError`.
- `apps/web-app/src/features/trip-planner/api/{trip-by-id, plan-trip}.ts` — extend the response zod schema; do NOT fork the hooks.
- `packages/ui::{Field, FieldLabel, FieldControl, FieldDescription, FieldError, Sidebar, SidebarGroup}` — already installed.
- `apps/web-app/src/features/trip-planner/utils/{format-distance, format-duration}.ts` — pattern precedent for the new `format-start-at.ts` (same export shape, pure function, colocated `.test.ts`).

## Architecture invariants verified

- **#1 (HOS planner pure Python)** — upheld. `hos_adapter.py` imports `web_api.hos`; `web_api.hos` does NOT import the adapter. The spec-05 boundary test still passes verbatim (no edits to `web_api/hos/**`).
- **#2 (every duty-status change writes a LogEvent)** — primary upholder. The adapter emits one `LogEvent` row per status change from the planner.
- **#3 (no raw ORS calls from browser)** — preserved. Spec 06 reads `Trip.route_*` columns; does not re-call ORS.
- **#4 (no client-side HOS math)** — preserved. The FE renders persisted rows in spec 07; this spec ships no FE math.
- **#5 (ownership-checked mutations + retrievals)** — `TripPlanView.get_queryset` filters on `request.user_id`. 404 on foreign — no oracle.
- **#6 (PDF export client-only)** — N/A.
- **#7 (theme tokens only)** — `start-at-field.tsx` uses `bg-card`, `text-foreground`, `border-input`, `ring-ring` semantic tokens. No hex.
- **#8 (no custom sub-agents)** — all reviewers from `wshobson/agents`.
- **#9 (specs drive implementation)** — this is the spec.

## Sub-agents to invoke

| Agent (plugin)                                     | When                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architect-review` (`comprehensive-review`)        | **First — against the SPEC TEXT** before implementation begins. Catches design drift on the adapter boundary, atomic ordering, FE/BE vertical-slice deviation justification. Then again against the diff. |
| `code-reviewer` (`comprehensive-review`)           | Mandatory before PR.                                                                                                                                                                                      |
| `python-pro` + `django-pro` (`python-development`) | Mandatory — migration design (AlterField + RunPython order), `bulk_create`, ORM hygiene, enum mirroring.                                                                                                  |
| `security-auditor` (`comprehensive-review`)        | Required — `TripPlanView` ownership gate, throttle config, `start_at` validator clock-skew tolerance.                                                                                                     |
| `ui-visual-validator` (`accessibility-compliance`) | Required — new datetime input a11y (label, error, `aria-invalid`), the new "Departs" line, mobile layout.                                                                                                 |
| `typescript-pro` (`javascript-typescript`)         | Recommended — zod patterns, `Intl.DateTimeFormat`, react-hook-form composition.                                                                                                                           |
| `performance-engineer` (`application-performance`) | Recommended — new endpoint write cost; plan response payload size.                                                                                                                                        |

Auto-trigger: `django-expert` on every `.py` in `apps/web-api/`; `react-architecture` + `react-doctor` on every `.tsx`.

## Citations to include inline (or in PR body)

- §395.8 RODS retention + home-terminal-TZ rule: cited in `web_api/apps/trips/hos_adapter.py` module docstring + `docs/interstate-truck-driver-guide.md:176`.
- Django 5.2 migration ordering (`AddField` → `RunPython` → `AlterField`): <https://docs.djangoproject.com/en/5.2/topics/migrations/>
- Django 5.2 `bulk_create` semantics + `ignore_conflicts`: <https://docs.djangoproject.com/en/5.2/ref/models/querysets/#bulk-create>
- DRF `RetrieveAPIView` + `get_queryset` filtering for ownership: <https://www.django-rest-framework.org/api-guide/generic-views/#retrieveapiview>
- DRF `MinValueValidator` on `DateTimeField`: <https://www.django-rest-framework.org/api-guide/fields/#datetimefield>
- zod `.datetime({ offset: true })`: <https://zod.dev/?id=datetimes>
- MDN `<input type="datetime-local">`: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local>
- `Intl.DateTimeFormat` `timeZone` option: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/DateTimeFormat>
- `context/architecture.md#Storage Model` — the table reservation.
- `context/architecture.md#Invariants` — #1, #2, #5 restated post-implementation.

Third-party versions verified at PR-write time via `npm view <pkg> version` and `curl pypi.org/pypi/<pkg>/json`; resolved versions recorded in the PR body. No new dependencies added.

## UI anti-patterns to avoid

1. **NO `<CardHeader>` / `<CardTitle>` around the new form field.** It lives inside the existing `FieldGroup`; the page header above is enough.
2. **NO clock or calendar icon on the `<dt>Departs</dt>` line.** Pure typography. `<dt>` carries meaning. Icons here would mirror the spec-04 anti-pattern #7.
3. **NO "Edit start time" button on `/trips/:id`.** `start_at` is immutable post-creation in v1 (per Out of Scope). The detail panel displays; it does not edit.
4. **NO timezone abbreviation suffix** ("EDT" / "EST") on the "Departs" line. The `Intl.DateTimeFormat` output is already in the home-terminal TZ; appending the abbreviation duplicates info and breaks across DST transitions.
5. **NO seconds in the formatted "Departs" string.** `timeStyle: "short"` is the right precision; `dateStyle: "medium"` matches the dense-pro-tool aesthetic.
6. **NO `<Separator />` between the new "Departs" line and the existing route lines.** Same SidebarGroup, single `<dl>` — sibling rows, not separated sections.
7. **NO setInterval / setTimeout in `start-at-field.tsx`.** The default value is memoized once; the form stays stable.
8. **NO `bg-blue-500`-style raw Tailwind colors.** Semantic tokens only.
9. **NO comments restating the code in the adapter.** Comments only for the WHY (e.g., the §395.8 home-terminal-TZ rule inside `_emit_log_days` is non-obvious — that's a WHY-comment).
10. **NO unused exports.** Every named export has a callsite in the same unit. `mockTripPlanInline` was proposed but dropped (per decision 16 / architect-review m6) — it would have been the lone exception.

## Verification (the unit is not done until every box is ticked)

- [ ] `pnpm exec turbo run lint typecheck test build --filter=web-app --filter=@outbound/ui` is green.
- [ ] `pnpm format:check` is green.
- [ ] `cd apps/web-api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest` is green.
- [ ] CI grep / spec-05 boundary test still passes — `web_api/hos/**` is untouched in spec 06 (confirms invariant #1 is intact).
- [ ] Migration 0004 applies cleanly to a FRESH SQLite test DB AND to the local Postgres `outbound_dev` (which has spec-03 and spec-04 rows that need `start_at` backfilled from `created_at`). Reverse migration restores the prior shape.
- [ ] `LogEvent` row count = `len(plan_logs(inputs))` for the Richmond → Fredericksburg → Newark golden trip (spec 05's `assessment_simple` golden).
- [ ] `TripStop` row count = pickup + dropoff + (fuel stops) for the same trip.
- [ ] `LogDay.driving_s + on_duty_not_driving_s + off_duty_s + sleeper_s == 86400 * len(days)` for the same trip (24-hour totals balance).
- [ ] Ownership: 200 own / 401 unauthenticated / 404 missing / 404 foreign on `/api/trips/<id>/plan/`.
- [ ] Atomicity: forcing `hos_adapter.materialize_plan` to raise via mock → no Trip row, no plan rows in the DB after the request (transaction rolled back).
- [ ] `start_at` validator reads `timezone.now()` fresh per request (architect-review M1) — `test_start_at_past_rejected_at_request_time` uses `freezegun` to advance the BE clock and asserts a request that would have been valid at boot is rejected after advancing.
- [ ] `TripPlanView.get_object` returns a `Trip` instance, not a dict (architect-review M2). `TripPlanSerializer.to_representation` composes the envelope from the prefetched related collections (zero N+1 queries — assert via `django_assert_num_queries(2)` on the retrieve test: one for the Trip + ownership filter, one for the prefetch batch).
- [ ] Midnight-crossing event splits proportionally across `LogDay` rows (architect-review m1) — `test_midnight_crossing_drive_splits_miles_proportionally` synthesizes a 5h DRIVING event spanning midnight and asserts day-1 + day-2 `driving_s` sum equals the event total.
- [ ] Enum parity asserted in the spec-05 boundary test (architect-review m4) — `test_duty_status_parity_with_django_choices` fails if `DutyStatus` and `DutyStatusChoices` diverge.
- [ ] `TripStop.scheduled_at` matches its originating `LogEvent.start` (architect-review m7) — `test_stop_scheduled_at_matches_originating_event_start`.
- [ ] Throttle: 121st `GET /api/trips/<id>/plan/` inside one minute returns 429.
- [ ] FE: `start-at-field` renders with `<input type="datetime-local">`; default value is ≥ now rounded up to next 15 min; submitting a past value shows the zod refinement message via `<FieldError>` with `data-invalid="true"` on the field; round-trips via MSW.
- [ ] FE: `TripDetailPanel` Route SidebarGroup shows "Departs" line below distance/duration; format matches `Intl.DateTimeFormat("en-US", {dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York"})`.
- [ ] No hex literals or `bg-*-500`-style raw Tailwind colors in any file under `apps/web-app/src/features/trip-planner/`.
- [ ] Manual browser smoke (Step 7) walks the golden trip on mobile 375×667 + desktop 1440×900. Screenshots in PR body for the form + the detail panel.
- [ ] `code-reviewer`, `architect-review` (against the diff), `python-pro` + `django-pro`, `security-auditor`, `ui-visual-validator` have reviewed the diff; no unresolved CRITICAL findings.
- [ ] Branch `feat/06-hos-persistence-start-at-plan-endpoint`; PR base `develop`.
- [ ] `.github/pull_request_template.md` filled verbatim; Conventional Commit subjects (`feat(trip):`, `feat(web-app):`, `feat(web-api):`, etc.); no `Co-Authored-By` trailer; no `--no-verify`.
- [ ] `context/architecture.md` updated with the three new tables in Storage Model + invariant #1, #2 restates.
- [ ] `context/progress-tracker.md` updated as the **last** committed file — spec 06 → Completed; Next Up updated (spec 07 = Leaflet map; spec 08 = §395.8 SVG; spec 09 = PDF).

## Out of scope (deliberate — don't touch in this unit)

- Leaflet map renderer → spec 07.
- §395.8 SVG log renderer → spec 08.
- PDF export → spec 09.
- Re-plan-on-edit UI for `start_at` → future spec. v1: `start_at` is immutable; editing requires a new trip.
- Driver-profile timezone column → future spec. v1: hard-coded `America/New_York`.
- Reverse-geocoded `TripStop.label` / `LogEvent.location` labels → future spec.
- §395.1(g) split-sleeper pairing → future spec (per spec 05 decision 9).
- TanStack Query hook for `GET /api/trips/<id>/plan/` → spec 07 (per decision 15).
- Saved-trips list / per-row plan retrieval → future spec.
- 60/7 cycle-mode toggle, hazmat, personal conveyance, yard moves — already deferred per `project-overview.md`.

## Open questions

None blocking at write time. Three known-unknowns documented for the implementer (resolve inline + record in progress-tracker if encountered):

- **`start_at` clock-skew across server / client clocks.** The 5-minute slack on the `MinValueValidator` covers most cases, but a driver with a misconfigured device clock (e.g., 30 min ahead) would see all their submissions rejected. v1 absorbs this; a future spec could echo the BE's `timezone.now()` back to the FE on form load and validate against that instead of `Date.now()`. Document in the implementation notes if a real user reports the issue.
- **`LogDay` daylight-savings edges.** A trip that spans a DST transition will have one `LogDay` with `> 86400` total seconds (spring fall: 23 hours) or `< 86400` (fall back: 25 hours). The denormalization treats `home_terminal_local_date` as the bucket key — the totals reflect the actual seconds in each duty status per local-date, which is correct per §395.8. The verification checklist's "24-hour totals balance" assertion needs a DST-aware variant; defer to spec 08 (SVG renderer) where the totals are user-visible.
- **Bulk-create ordering vs sequence field.** `Model.objects.bulk_create(rows, ignore_conflicts=False)` does NOT guarantee insertion order on Postgres; the `sequence` field is set explicitly by the adapter to the planner's emit order, so the unique constraint catches any drift. If a future Postgres version reorders inserts to optimize page layout, the `sequence` field stays authoritative.
