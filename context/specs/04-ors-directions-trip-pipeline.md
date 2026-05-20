# 04 — ORS Directions + Trip Pipeline

> Upgrades the stub `POST /api/trips/` from spec 03 into the real routing pipeline — OpenRouteService `driving-hgv` Directions API, polyline + per-leg segments + summary persisted on `Trip`, server-side response cache, scoped per-user throttle on the geocoder + trip-create endpoints — and fills the `/trips/:id` placeholder with a dense, single-`<dl>` route-summary surface. Leaflet ships in spec 06 alongside HOS stop overlays; this spec persists the polyline "ready to draw."

## Goal

Close the trip-input → trip-output loop. A signed-in driver who submits the spec-03 form now sees an actual route summary — total distance, total duration, per-leg breakdown — within ~3 s on a normal connection (ORS p95 ≈ 800 ms; the rest is the geocoder cache + render). Architecture invariants from `context/architecture.md` hold: the ORS API key never leaves `web_api/integrations/openrouteservice.py` (#3), no client-side HOS math (#4), every mutation checks ownership via `request.user_id` (#5), semantic tokens only in components (#7), HOS planner untouched (#1), specs drive implementation (#9).

The four user-visible additions:

1. **Real route data**: `POST /api/trips/` calls ORS Directions, persists `route_polyline` + `route_segments[]` + `route_summary` + `route_error_code` on `Trip`, and returns the saved trip. A cache hit on a SHA256-keyed `trip_route_cache` short-circuits ORS so the HeiGIT 2000/day quota survives the assessment review.
2. **Route summary surface** on `/trips/:id`: single `<Card>` → `<CardContent>` → one `<dl>` with two `<div role="group">` blocks (hero metrics + per-leg breakdown). No `<CardHeader>` — the sticky page header already says "Trip workspace"; duplicating it would violate the explicit anti-duplication directive surfaced during this spec's planning session.
3. **Compact Route row** in the existing `TripDetailPanel` (the second sidebar): status badge + `342.7 mi · 5h 18m` single-line. The badge appears once per surface — never duplicated.
4. **Scoped per-user throttle** (`PerUserScopedThrottle` keyed by `request.user_id`) on `/api/geocode/autocomplete/` (60/min), `/api/geocode/search/` (20/min), `/api/trips/` create (30/hour). Closes the security/perf deferrals queued in `context/progress-tracker.md` (Session Notes line 91).

## Decisions of record (resolved at planning time)

These were resolved during the spec-04 planning session and are recorded here so future implementers don't re-litigate and senior review can audit the rationale. The companion plan file lives at `/Users/mateo/.claude/plans/role-you-are-a-cuddly-music.md`.

**Backend**

1. **Single FE+BE vertical slice over a FE/BE split.** Same deviation precedent as spec 03. `context/ai-workflow-rules.md#Scoping rules` says split FE/BE; the deviation is approved because (a) the BE alone leaves the `/trips/:id` placeholder ("The Leaflet map and §395.8 ELD log sheets land in the next spec") visually unchanged — zero user-value; (b) the FE alone has no route data; (c) splitting forces a contract-only intermediate spec that delivers no user-visible work. Recorded inline so senior review sees it intentionally.

2. **Endpoint variant**: `POST https://api.openrouteservice.org/v2/directions/driving-hgv/geojson`. The `/geojson` suffix is the documented way to get a GeoJSON FeatureCollection back — cleaner than `Accept`-header negotiation and matches the pattern Pelias does NOT support (Pelias is always GeoJSON, hence the existing Pelias client uses `Accept: application/geo+json`). Cite <https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types>.

3. **Auth header**: `Authorization: <api_key>` verbatim — NOT `Authorization: Bearer <api_key>`. The ORS forum thread confirms it (<https://ask.openrouteservice.org/t/api-call-setup-question/4984>); the existing Pelias client already follows this pattern.

4. **Request body**: `{"coordinates": [[lon, lat], …], "instructions": false, "units": "mi", "preference": "recommended"}`. `profile_params` (axle weight, hazmat) omitted — `project-overview.md#Out of Scope` excludes hazmat. `instructions: false` strips per-step turn-by-turn from each `segments[].steps` since we don't visualize them in v1. `units: "mi"` returns `distance` in miles on `summary` and each `segments[]`; `duration` is ALWAYS in seconds regardless of `units`. Cite <https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options>.

5. **Response parsing**:
   - `features[0].geometry.coordinates` → `route_polyline` (raw `[lon, lat]` pairs; the `/geojson` suffix guarantees `LineString`, NOT polyline5).
   - `features[0].properties.summary` → `route_summary = {"distance_mi": float, "duration_s": int}`.
   - `features[0].properties.segments[]` (N-1 elements for N input coordinates) + `features[0].properties.way_points[]` (index pairs into the geometry, one per leg) → `route_segments[] = [{"distance_mi", "duration_s", "from_index", "to_index"}, …]`. The indices let a future map renderer slice `route_polyline` per leg without re-deriving them.

6. **Retry policy update**: extend the existing `urllib3.Retry.allowed_methods` (today `frozenset({"GET"})`) to include `"POST"`, scoped to the existing `status_forcelist=(502, 503, 504)` only. 429 stays non-retried (deterministic — preserves `OrsRateLimitError`). A module docstring in `openrouteservice.py` records the assumption that all ORS endpoints are read-only-effectively, so POST retry on transient 5xx is safe; if a future ORS endpoint mutates state, it requires its own non-retrying session.

7. **Exception mapping** (`directions_hgv` raises):
   - 429 → `OrsRateLimitError(window="per-minute")`.
   - 403 with body message containing `"quota"` (case-insensitive) → `OrsRateLimitError(window="daily")`.
   - 403 with body message NOT containing `"quota"` → `OrsRequestError` (auth/config — louder log; deserves operator attention, not user-facing rate-limit copy).
   - 401 → `OrsRequestError` (auth — treated identically to non-quota 403; ORS conflates these but the public docs are inconsistent, so we map both to "operator attention").
   - 400 → `OrsRequestError`.
   - 5xx (after one retry) → `OrsUpstreamError`.

   The `window` literal is captured on the existing `OrsRateLimitError` (extend its `__init__` to take a `*, window: Literal["per-minute", "daily"]` kwarg) so the view layer can log it; the FE only ever sees the unified `route_error_code` enum.

8. **Observability**: log `x-ratelimit-remaining` and `x-ratelimit-reset` at `DEBUG` level on every Directions response. ORS does NOT send `Retry-After`; the `x-ratelimit-*` headers are the canonical signal during the assessment review. Cite <https://giscience.github.io/openrouteservice/frequently-asked-questions.html>.

9. **`TripStatus` enum drops `PENDING`.** `class TripStatus(models.TextChoices)`: `PLANNING / PLANNED / FAILED`. `PENDING` was the spec-03 stub default and is dead state from spec 04 onward — the pipeline transitions PLANNING → PLANNED | FAILED inside the request handler. Migration 0002 includes a `RunPython` step that updates any existing `"pending"` rows (from spec-03's local Postgres bootstrap — see `context/progress-tracker.md` decision 2026-05-19 "Local Postgres role + DB created") to `"planning"` BEFORE the `choices` constraint is applied. The reverse migration restores `"pending"` to keep the migration symmetric.

10. **`Trip` model upgrade** (additive, all nullable so the FAILED case persists cleanly):
    - `route_polyline = JSONField(null=True, blank=True)` — list of `[lon, lat]` pairs (JSON-native floats).
    - `route_segments = JSONField(null=True, blank=True)` — `[{"distance_mi": float, "duration_s": int, "from_index": int, "to_index": int}, …]`.
    - `route_summary = JSONField(null=True, blank=True)` — `{"distance_mi": float, "duration_s": int}`.
    - `route_error_code = CharField(max_length=32, null=True, blank=True)` — enum surface: `"rate_limit_per_minute" | "rate_limit_daily" | "upstream" | "validation"`.
    - `Trip.status` default → `TripStatus.PLANNING`.
    - Route data lives on `Trip` (NOT in a sibling `TripRoute` 1:1 table): the route is structurally 1:1 with the trip; a sibling adds a join with zero ergonomic gain. Future-lift path (when spec 09 ships re-planning) is documented inline in `context/architecture.md#Storage Model`.

11. **`TripRouteCache` model** (same `models.py` file): PK `cache_key = CharField(primary_key=True, max_length=64)` (SHA256 hex). Fields: `coords_canonical = CharField(max_length=255)` (denormalized — lets an operator decode which trip the row caches without re-deriving the hash), `payload = JSONField()` (`dataclasses.asdict(DirectionsResult)`), `created_at = DateTimeField(auto_now_add=True)`. No additional index (PK covers lookup). No TTL — the assessment review window is short; eviction = bump `_CACHE_KEY_VERSION`.

12. **Cache key canonical form**: a single string built as

    ```
    f"v1|driving-hgv|recommended|mi|{cur_lon:.5f},{cur_lat:.5f}|{pickup_lon:.5f},{pickup_lat:.5f}|{dropoff_lon:.5f},{dropoff_lat:.5f}"
    ```

    SHA256 hex digest → `cache_key`. The `v1|` schema epoch lets us evict the entire cache in one motion by bumping the prefix when the request shape changes (e.g., if spec 09 ships re-planning with `avoid_features`). Constant `_CACHE_KEY_VERSION = "v1"` lives in `services.py`. 5-decimal lat/lon rounding ≈ 1.1 m precision — Pelias returns deterministic coords for the same address, so the cache is structurally hit-friendly without false collisions.

13. **`plan_trip(serializer_data, user_id) -> Trip`** in new `web_api/apps/trips/services.py`. Pipeline:
    1. `transaction.atomic()`: persist `Trip` in `PLANNING` status (the resource ID exists even if the route step fails — the FE has a real `/trips/:id` to land on).
    2. Build canonical coords string + SHA256 → `cache_key`.
    3. `TripRouteCache.objects.filter(pk=cache_key).first()`. Hit → use payload, skip ORS. Miss → call `openrouteservice.directions_hgv(coords)`. On success, `TripRouteCache.objects.create(cache_key=…, coords_canonical=…, payload=asdict(result))`.
    4. Persist `route_polyline / route_segments / route_summary` on the `Trip`. Transition to `PLANNED`.
    5. On any `OrsError`: catch at this boundary. Update the same `Trip` row to `FAILED` with the matching `route_error_code`. Do NOT raise — the view returns the FAILED `Trip` and the FE renders the inline error state.

14. **HTTP semantics**: 201 on PLANNED AND on FAILED. The Trip resource WAS created; the route side-effect succeeded or failed downstream. The FE branches on the `status` field, not on HTTP. Mirrors the pattern where Anthropic's `/v1/messages` returns 200 with `stop_reason: "tool_use"` — the request succeeded; the outcome it describes is a downstream signal.

15. **Discriminated response shape**: when `status="failed"`, `route_polyline / route_segments / route_summary` are explicitly `null` (not absent). The FE zod schema is a discriminated union on `status`; the FE never branches on key presence — always on `status`. The serializer emits all four route fields unconditionally.

16. **Throttle**: new `web_api/throttling.py::PerUserScopedThrottle(ScopedRateThrottle)` with `get_cache_key(self, request, view) -> str | None: return f"throttle_{self.scope}_{request.user_id}" if getattr(request, "user_id", None) else None`. Subclassing is necessary because the upstream `ScopedRateThrottle.get_cache_key` keys on `request.user` (which `ClerkAuthentication` does NOT set; only `request.user_id`) and falls back to anonymous IP — meaning two drivers behind one NAT would share a bucket. Settings:
    - `DEFAULT_THROTTLE_CLASSES = ["web_api.throttling.PerUserScopedThrottle"]`.
    - `DEFAULT_THROTTLE_RATES = {"geocode_autocomplete": "60/min", "geocode_search": "20/min", "trip_create": "30/hour"}`.
    - `throttle_scope` attributes on `GeocodeAutocompleteView`, `GeocodeSearchView`, `TripCreateView`.

    Anonymous throttling is unnecessary — every endpoint is `IsAuthenticated`. Cite <https://www.django-rest-framework.org/api-guide/throttling/>.

**Frontend**

17. **Leaflet renderer is DEFERRED.** Spec 04 persists the polyline and ships the summary surface; spec 06 ships the map renderer with HOS stop overlays from spec 05, so the map ships once with everything it needs (`docs/assesment.md`: "Map showing route AND information regarding stops and rests"). User confirmed this scope during the planning session (option A in the AskUserQuestion prompt; see the plan file).

18. **`TripsDetailRoute` main area** = single `<Card>` with `<CardContent>` containing one `<dl>`. NO `<CardHeader>`, NO `<CardTitle>`, NO `<CardDescription>` — the sticky page header already says "Trip workspace"; a second title violates the user's explicit "no duplicate titles" directive surfaced during planning.

19. **`<dl>` composition**: one `<dl>` with two `<div role="group">` blocks (the `<div role="group">` wrapping `<dt>`/`<dd>` pairs is the canonical accessible-name container — <https://www.w3.org/WAI/ARIA/apg/patterns/grid/>; we use it here for the dl's two logical sections, not for layout).
    - Block 1 — hero metrics: `<dt>Total distance</dt><dd>342.7 mi</dd>` + `<dt>Total duration</dt><dd>5h 18m</dd>`. Values render `text-2xl font-mono`; labels render `text-xs uppercase tracking-wide text-muted-foreground`.
    - Block 2 — per-leg rows: `<dt>Current → Pickup</dt><dd>67.4 mi · 1h 12m</dd>` + `<dt>Pickup → Dropoff</dt><dd>275.3 mi · 4h 06m</dd>`. Values render `text-sm font-mono`; labels render `text-xs text-muted-foreground`.
    - Visual separator = `border-t border-border pt-4 mt-4` on block 2 (NOT a shadcn `<Separator />` — overkill inside a `<dl>` and adds a non-grouping element).

20. **Status branches in `TripsDetailRoute` main area**:
    - `PLANNED` → render the `<dl>` summary inside `<Card><CardContent>`.
    - `PLANNING` → `<SpotterLoader size="lg" />` centered. Rare race: the 201 returns before TanStack Query refetches; `useTripById` falls back to its `isPending` branch.
    - `FAILED` → `<Empty>` with `<EmptyTitle>` keyed by `route_error_code` and `<EmptyDescription>` providing next-action guidance + `<Link to={paths.tripsNew}>Plan a new trip</Link>`. NO retry button (retry is spec 09 / Saved Trips territory).

    Copy variants (encoded in `route-summary.tsx` as a const map `ROUTE_ERROR_COPY: Record<RouteErrorCode, { title: string; body: string }>`):
    - `rate_limit_per_minute` → title "Routing service is busy", body "We hit the per-minute routing quota. Try again in a moment."
    - `rate_limit_daily` → title "Daily routing quota exhausted", body "The routing service is rate-limited until tomorrow. Try again then."
    - `upstream` → title "Couldn't reach the routing service", body "The routing service didn't respond. Try again in a moment."
    - `validation` → title "Couldn't plan this route", body "The routing service refused these coordinates. Try slightly different addresses."

21. **`TripDetailPanel` (side panel)**: keep the existing input recap (3 address labels + cycle hours) and add one compact "Route" sub-section ABOVE the input recap: status badge (single line) + `font-mono text-sm` distance + duration single-line ("342.7 mi · 5h 18m"). When `status="failed"`: badge in `destructive` variant + dash-line copy ("— · —"). NO per-leg breakdown in the panel (lives in the main area to avoid duplication). NO `<CardHeader>`-style wrapper here either; the side panel uses `<SidebarGroup>` + `<SidebarGroupLabel>` per the existing composition.

22. **Status badge appears ONCE per surface** — only in the side panel. NOT also in the main route-summary card. Surface separation matters: side panel = chrome / status overview; main area = the artifact itself.

23. **NO icons on metric labels.** Pure typography; `<dt>` semantics carry the meaning. `lucide-react` icons here would read as decorative chrome and break the dense-pro-tool aesthetic anchored on `context/ui-context.md`.

24. **NO "coming soon: map" placeholder under the summary.** The summary IS the deliverable for spec 04. Spec 06 replaces the main-area component when the map ships; until then, the summary stands alone as a complete artifact, not a teaser.

25. **TanStack Query**: extend `TripResponse` zod schema in new `apps/web-app/src/features/trip-planner/schemas/trip-response.ts` to a `z.discriminatedUnion("status", [plannedSchema, planningSchema, failedSchema])`. `useTripById` and `usePlanTrip` keep their signatures; only the response type widens. The fetch wrapper (`lib/api-client.ts::apiFetch`) is untouched.

26. **MSW helpers**: `mockTripPlanned(overrides?)`, `mockTripFailed(reason?: RouteErrorCode)`, `mockTripPlanning()` exported from `apps/web-app/src/testing/handlers.ts` as named exports. Tests call `server.use(mockTripFailed("rate_limit_daily"))` for status-branch coverage.

## Scope

### In

**`apps/web-api` — ORS client + Trip model + service + throttle:**

- `web_api/integrations/openrouteservice.py` — extend with `directions_hgv(coordinates: Sequence[tuple[float, float]]) -> DirectionsResult`. Add dataclasses `DirectionsSegment(distance_mi, duration_s, from_index, to_index)`, `DirectionsSummary(distance_mi, duration_s)`, `DirectionsResult(polyline, summary, segments)` (all frozen, slots). Extend `OrsRateLimitError` with `*, window: Literal["per-minute", "daily"]` kwarg. Update `Retry.allowed_methods` to `frozenset({"GET", "POST"})`. Module docstring explains the read-only-effectively assumption.
- `web_api/throttling.py` (NEW) — `PerUserScopedThrottle(ScopedRateThrottle)` with `get_cache_key` keyed by `request.user_id`.
- `web_api/apps/trips/models.py` — `TripStatus(TextChoices)` enum; `route_polyline / route_segments / route_summary / route_error_code` fields on `Trip`; new `TripRouteCache` model.
- `web_api/apps/trips/services.py` (NEW) — `plan_trip(serializer_data, user_id) -> Trip` pipeline; `_CACHE_KEY_VERSION = "v1"` constant; `_build_cache_key(coords) -> str` helper.
- `web_api/apps/trips/serializers.py` — `TripResponseSerializer.Meta.fields` extended with `route_polyline / route_segments / route_summary / route_error_code`. Request serializer untouched.
- `web_api/apps/trips/views.py` — `TripCreateView` delegates to `plan_trip`; `throttle_scope = "trip_create"` attribute added. `TripRetrieveView` untouched.
- `web_api/apps/trips/migrations/0002_trip_route_fields_and_cache.py` (NEW — generated by `makemigrations` + `RunPython` for `"pending"` → `"planning"` transition).
- `web_api/apps/geocoding/views.py` — `throttle_scope = "geocode_autocomplete"` / `"geocode_search"` attributes.
- `web_api/settings/base.py` — `REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]` + `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`.

**`apps/web-app` — types, summary surface, panel update, helpers:**

- `apps/web-app/src/features/trip-planner/schemas/trip-response.ts` (NEW) — zod discriminated union on `status` + exported `RouteErrorCode` type.
- `apps/web-app/src/features/trip-planner/api/trip-by-id.ts` — `TripResponse` type widens to the discriminated union; runtime parse via the new schema.
- `apps/web-app/src/features/trip-planner/api/plan-trip.ts` — same widening; `onSuccess` navigation behavior unchanged.
- `apps/web-app/src/features/trip-planner/utils/format-duration.ts` (NEW) — `(seconds: number) => string` ("5h 18m"; sub-minute rounds to `"<1m"`).
- `apps/web-app/src/features/trip-planner/utils/format-distance.ts` (NEW) — `(miles: number) => string` ("342.7 mi"; 1 decimal).
- `apps/web-app/src/features/trip-planner/components/route-summary.tsx` (NEW) — the `<Card><CardContent><dl>…</dl></CardContent></Card>` surface; handles all three statuses via internal status discrimination.
- `apps/web-app/src/features/trip-planner/components/trip-detail-panel.tsx` — add the compact Route sub-section.
- `apps/web-app/src/app/routes/trips-detail.tsx` — replace the placeholder Card with `<RouteSummary trip={trip.data} />`.

**Tests (mandatory minimum):**

- `apps/web-api/tests/test_directions_client.py` (NEW) — success, 400, 429, 403-with-quota, 403-without-quota, 5xx-after-retry, malformed-body. `unittest.mock.patch` on `_session.post` — no new test dependency.
- `apps/web-api/tests/test_trip_pipeline.py` (NEW) — success (status transitions PLANNING → PLANNED), cache hit (no ORS HTTP call), cache miss (ORS called + cache row written), 429-from-ORS (status → FAILED, `route_error_code="rate_limit_per_minute"`), 403-quota-from-ORS (`route_error_code="rate_limit_daily"`), 5xx-from-ORS (`route_error_code="upstream"`), 201 returned on FAILED.
- `apps/web-api/tests/test_throttling.py` (NEW) — 31st `POST /api/trips/` inside one hour returns 429; 61st `GET /api/geocode/autocomplete/?text=…` inside one minute returns 429; 21st `GET /api/geocode/search/?text=…` inside one minute returns 429. Each test uses a different Clerk user id to verify per-user keying.
- `apps/web-api/tests/test_trips_views.py` — extend with: serializer emits all four route fields; PLANNED trip retrieve returns populated route data; FAILED trip retrieve returns the error code; existing 401/403/404 tests still pass.
- `apps/web-app/src/features/trip-planner/components/route-summary.test.tsx` (NEW) — PLANNED renders both groups in one `<dl>`; PLANNING renders SpotterLoader; FAILED renders Empty with the correct copy per `route_error_code`.
- `apps/web-app/src/features/trip-planner/components/trip-detail-panel.test.tsx` — extend: compact Route row renders + status badge variant flips on FAILED.
- `apps/web-app/src/app/routes/trips-detail.test.tsx` — extend: each status renders the right main-area surface.
- `apps/web-app/src/features/trip-planner/utils/format-duration.test.ts` (NEW), `format-distance.test.ts` (NEW) — pure-function unit tests.
- `apps/web-app/src/testing/handlers.ts` — extend the trip handlers with the new fields + `mockTripPlanned / mockTripFailed / mockTripPlanning` helpers.

### Out (deferred, in this order)

- **Spec 05 — HOS planner foundation.** Pure-Python `web_api/hos/` module with deterministic `LogEvent` dataclasses; golden tests against `docs/assets/example-complete-grid.png` and the FMCSA paragraphs in `docs/interstate-truck-driver-guide.md`. No Django imports — invariant #1.
- **Spec 06 — Leaflet map renderer.** `react-leaflet@5` + `leaflet@1.9.4` + OSM tiles. `<TripMap>` lazy-loaded via `React.lazy`. Brand-themed `divIcon` markers for current/pickup/dropoff. HOS stop overlays from spec 05 layered on top. Vite `manualChunks` splits the Leaflet bundle.
- **Spec 07 — Daily Log SVG renderer.** §395.8 grid, Remarks column, hour totals. Inputs: the `LogEvent[]` from spec 05's planner.
- **Spec 08 — PDF export.** Client-side `svg2pdf.js` + `jsPDF` over the spec-07 SVGs.
- **Spec 09 — Saved Trips list + history** in the sidebar (replaces the disabled placeholder). Includes per-row retry action for FAILED trips — the retry-button territory deferred from spec 04 (decision 20).
- **Apple OAuth, account settings, i18n, magic-link, MFA** — already deferred.

## Prerequisites (already true)

- Spec 03 is merged on `develop`. The trip-input form ships address resolution with `(label, lat, lon, confidence)` on `current`, `pickup`, `dropoff`; the `Trip` stub model exists with the spec-03 echo response; the dual-sidebar shell renders `TripInputPanel` on `/trips/new` and `TripDetailPanel` (input recap) on `/trips/:id`.
- The existing ORS client (`web_api/integrations/openrouteservice.py`) ships `_session` with the 5xx retry policy, the four `OrsError` subclasses, the `OPENROUTESERVICE_API_KEY: SecretStr` setting, and the `OPENROUTESERVICE_BASE_URL` allowlist validator.
- `web_api/exception_handler.py` returns `{"detail": str, "errors": {...} | null}`.
- `web_api/auth/authentication.py::ClerkAuthentication` sets `request.user_id` from the JWT `sub` claim.
- Pytest test settings (`web_api/settings/test.py`) run against SQLite in-memory; `tests/conftest.py` patches Clerk's `authenticate_request` and provides `authenticated_client` + `TripFactory`.
- `apps/web-app` ships `apiFetch<T>` + `ApiError`, the `useTripById` / `usePlanTrip` hooks, the `mockTripPlanned`-shaped MSW handlers, and the `<RouteHandle.Secondary>` route convention that powers the second sidebar.
- All shadcn primitives this spec composes (`Card`, `CardContent`, `Badge`, `Empty`, `EmptyTitle`, `EmptyDescription`, `Skeleton`, `Alert`, `Separator`, `Sidebar`, `SidebarGroup`) are already installed under `packages/ui/src/components/ui/`. **Spec 04 adds zero new shadcn primitives.**
- Local Postgres role `outbound` + database `outbound_dev` exist (spec-03 bootstrap). The migration includes the `RunPython` step so an existing `"pending"` row from that bootstrap upgrades cleanly.

## Boundary

- Touches `apps/web-api/web_api/{integrations/openrouteservice.py, throttling.py, settings/base.py, apps/{geocoding/views.py, trips/}}`.
- Touches `apps/web-app/src/{features/trip-planner/{api,components,schemas,utils}/, app/routes/trips-detail.tsx, testing/handlers.ts}`.
- Touches `context/{architecture.md, progress-tracker.md}` (post-implementation, last commits).
- Does **not** touch `apps/web-auth/`, `apps/web-api/web_api/hos/`, `apps/web-api/web_api/auth/`, `docs/`, `.github/workflows/`, `.husky/`, `turbo.json`, `packages/ui/**`, `packages/eslint-config/**`, `packages/typescript-config/**`, any spec-03-owned route or component beyond the additions named above.

**Boundary deviation — single FE+BE vertical slice (mirrors spec 03's deviation).** `context/ai-workflow-rules.md#Scoping rules` says split FE/BE into ordered units. This spec deviates because: (a) the BE alone produces a `/trips/:id` row that still renders the existing placeholder — zero user-visible change; (b) the FE alone has no route data to display; (c) splitting would force a contract-only intermediate spec that ships zero verifiable user value. The deviation is recorded here so senior review sees it intentionally. Spec 05 (HOS planner) and spec 06 (Leaflet map + stop overlays) ship as separate units because each is one boundary apiece.

## Sequencing

Order matters: backend lands first so the FE can drive against real data; the schema/util shims land before the components that consume them.

### Step 1 — BE: ORS client `directions_hgv`

1. Extend `web_api/integrations/openrouteservice.py`:
   - Add `OrsRateLimitError.__init__(self, message: str, *, window: Literal["per-minute", "daily"])`; store on `self.window`.
   - Add frozen-slots dataclasses `DirectionsSegment`, `DirectionsSummary`, `DirectionsResult`.
   - Add `directions_hgv(coordinates: Sequence[tuple[float, float]]) -> DirectionsResult`. POST to `f"{base}/v2/directions/driving-hgv/geojson"` with the canonical body; parse via the dataclasses; map errors per decision 7.
   - Update the shared `Retry` to `allowed_methods=frozenset({"GET", "POST"})`. Module docstring documents the read-only-effectively assumption.
   - Log `x-ratelimit-remaining` / `x-ratelimit-reset` at DEBUG if present.
2. `tests/test_directions_client.py`: mock `_session.post` via `unittest.mock.patch`; cover the seven scenarios in Scope §Tests.
3. `uv run pytest tests/test_directions_client.py`, `uv run ruff check`, `uv run mypy` all green.

### Step 2 — BE: Trip model + TripRouteCache + migration

1. Edit `web_api/apps/trips/models.py`:
   - Add `class TripStatus(models.TextChoices): PLANNING = "planning", "Planning"; PLANNED = "planned", "Planned"; FAILED = "failed", "Failed"`.
   - Add the four route fields + flip `Trip.status` default to `TripStatus.PLANNING`. Keep `max_length=16`.
   - Add `class TripRouteCache(models.Model): cache_key (PK), coords_canonical, payload, created_at`.
2. `uv run python manage.py makemigrations trips`. Inspect the generated migration; ADD a `RunPython` operation **between the `AddField` operations and the `AlterField` for `status` choices** (forward order: `AddField` ×4 → `RunPython` → `AlterField` → `CreateModel TripRouteCache`):

   ```python
   def forward_pending_to_planning(apps, schema_editor):
       Trip = apps.get_model("trips", "Trip")
       Trip.objects.filter(status="pending").update(status="planning")

   def reverse_planning_to_pending(apps, schema_editor):
       Trip = apps.get_model("trips", "Trip")
       Trip.objects.filter(status="planning", route_polyline__isnull=True).update(status="pending")
   ```

   **Why this order, not "RunPython first":** the reverse `RunPython` filters `route_polyline__isnull=True`. Django executes migration operations in reverse order on a backward migration; if `RunPython` were the first forward op, it would be the last reverse op — running AFTER `AddField` has been reversed and the `route_polyline` column has been dropped, causing `ProgrammingError` on reverse. Placing `RunPython` after the `AddField` ops keeps both directions symmetric. Commit the migration verbatim; never re-edit post-apply.

3. `uv run python manage.py migrate`. Verify on the existing local DB that the spec-03 row's `status` transitioned from `"pending"` → `"planning"`.

### Step 3 — BE: `plan_trip` service + view delegation

1. Create `web_api/apps/trips/services.py`:
   - `_CACHE_KEY_VERSION = "v1"`.
   - `_build_cache_key(current_lon, current_lat, pickup_lon, pickup_lat, dropoff_lon, dropoff_lat) -> str` — returns SHA256 hex of the canonical form (decision 12).
   - `plan_trip(serializer_data, user_id) -> Trip` — implements the pipeline from decision 13. Uses `transaction.atomic()`.
2. Edit `web_api/apps/trips/views.py`:
   - `TripCreateView.create()` calls `plan_trip(serializer.validated_data, request.user_id)`; returns the `TripResponseSerializer` rendering with HTTP 201.
   - Add `throttle_scope = "trip_create"` (read after `IsAuthenticated` per DRF's order).
3. Edit `web_api/apps/trips/serializers.py`: `TripResponseSerializer.Meta.fields` += `"status"` (already present), `"route_polyline"`, `"route_segments"`, `"route_summary"`, `"route_error_code"`.
4. `tests/test_trip_pipeline.py`: seven cases per Scope §Tests. Verify the cache row is written on miss and not re-written on hit. Verify `_session.post` is NOT called on cache hit (mock then assert call_count).

### Step 4 — BE: throttle module + settings

1. Create `web_api/throttling.py`:

   ```python
   from rest_framework.throttling import ScopedRateThrottle

   class PerUserScopedThrottle(ScopedRateThrottle):
       def get_cache_key(self, request, view) -> str | None:
           user_id = getattr(request, "user_id", None)
           if user_id is None or not self.scope:
               return None
           return self.cache_format % {"scope": self.scope, "ident": user_id}
   ```

   (Reuses the upstream `self.cache_format` template — same shape as `UserRateThrottle.get_cache_key`.)

2. Edit `web_api/settings/base.py` `REST_FRAMEWORK`:
   - `"DEFAULT_THROTTLE_CLASSES": ["web_api.throttling.PerUserScopedThrottle"]`.
   - `"DEFAULT_THROTTLE_RATES": {"geocode_autocomplete": "60/min", "geocode_search": "20/min", "trip_create": "30/hour"}`.
3. Edit `web_api/apps/geocoding/views.py`: add `throttle_scope = "geocode_autocomplete"` to `GeocodeAutocompleteView` and `throttle_scope = "geocode_search"` to `GeocodeSearchView`.
4. `tests/test_throttling.py`: three cases per Scope §Tests. Use `override_settings` to lower the rate during the per-minute test so the suite stays fast; use the production rate for the per-hour test by mocking the cache to make the rate "look exhausted".

### Step 5 — FE: schemas + types

1. Create `apps/web-app/src/features/trip-planner/schemas/trip-response.ts`:
   - `RouteErrorCodeEnum = z.enum(["rate_limit_per_minute", "rate_limit_daily", "upstream", "validation"])`.
   - `routeSegmentSchema`, `routeSummarySchema`, `routePolylineSchema` (the `[number, number][]` shape).
   - Three branch schemas keyed on `status`: planned (all route fields present), planning (all null), failed (all null + `route_error_code`).
   - `tripResponseSchema = z.discriminatedUnion("status", […])`. Export `type TripResponse = z.infer<…>`.
2. Edit `apps/web-app/src/features/trip-planner/api/trip-by-id.ts` and `plan-trip.ts`: import the new schema, parse via `tripResponseSchema.parse(json)`, widen the function return type.
3. `pnpm exec turbo run typecheck --filter=web-app` green.

### Step 6 — FE: helpers + components

1. `features/trip-planner/utils/format-duration.ts` — `(seconds: number) => string`. Examples: `0` → `"0m"`, `45` → `"<1m"`, `60` → `"1m"`, `3600` → `"1h 0m"`, `19080` → `"5h 18m"`.
2. `features/trip-planner/utils/format-distance.ts` — `(miles: number) => string`. Examples: `0` → `"0.0 mi"`, `342.7` → `"342.7 mi"`.
3. `features/trip-planner/components/route-summary.tsx`:
   - Top-level `function RouteSummary({ trip }: { trip: TripResponse })`.
   - `switch (trip.status)` → render PLANNED `<dl>`, PLANNING `<SpotterLoader>`, FAILED `<Empty>` with the copy const map.
   - Single `<Card>` → `<CardContent className="space-y-4 p-6">` → the `<dl>`. PLANNING + FAILED render outside the Card (centered in the main area) to avoid an awkward "Card around a loader" framing.
4. Edit `features/trip-planner/components/trip-detail-panel.tsx`: add the compact Route `<SidebarGroup>` with label "Route" + the badge + the mono single-liner. Wire `status` + `route_summary` from the trip prop.
5. Edit `app/routes/trips-detail.tsx`: replace the placeholder Card branch with `<RouteSummary trip={trip.data} />`. Keep the `isPending` / `isError` branches as they are.

### Step 7 — FE: MSW + tests

1. Edit `apps/web-app/src/testing/handlers.ts`:
   - Extend the default `GET /api/trips/:id/` handler to return planned-shape data with `route_polyline`/`route_segments`/`route_summary` populated.
   - Export `mockTripPlanned(overrides?)`, `mockTripFailed(reason?)`, `mockTripPlanning()` (each returns an `http.get` / `http.post` `Handler`).
2. Vitest specs per Scope §Tests. AAA structure; `getByRole` > `getByLabelText` > `getByText` > `getByTestId`; `userEvent` not `fireEvent`.
3. `pnpm exec turbo run lint typecheck test --filter=web-app` green.

### Step 8 — Manual browser smoke

Run all three dev servers:

```bash
cd apps/web-api && uv run python manage.py migrate && uv run python manage.py runserver 0.0.0.0:8000
pnpm --filter web-auth dev
pnpm --filter web-app dev
```

Browser walk:

1. Open <http://localhost:5173/> → redirect to web-auth → sign in → land on `/trips/new`.
2. Fill the golden trip: Current = "Richmond, VA"; Pickup = "Fredericksburg, VA"; Dropoff = "Newark, NJ"; Cycle = 35.0 h. Submit.
3. Land on `/trips/:id`. Assert:
   - Side panel shows the compact Route row: a "Planned" badge + `~340 mi · ~5h 18m` (numbers depend on ORS's current routing; ±5% is acceptable).
   - Main area shows the single `<Card>` with the two `<dl>` groups; no `<CardHeader>`; no duplicate badge.
4. Re-submit the same golden trip from a fresh tab. In the `runserver` log, observe `cache_key=… hit=True` (or equivalent) and zero outbound HTTPS to `api.openrouteservice.org` (verify via the network tab if needed).
5. Submit a malformed trip (force a 400 from ORS by submitting coordinates the proxy can't route, e.g. far-offshore points) → the FE renders the FAILED Empty with the "Couldn't plan this route" copy.
6. Mobile (375×667) and desktop (1440×900) screenshots of the PLANNED + FAILED states in the PR body.

### Step 9 — Sub-agent passes

Run, in this order, against the diff (NOT against the spec text — spec text review happens before this PR opens):

1. `code-reviewer` (`comprehensive-review`) — mandatory.
2. `architect-review` (`comprehensive-review`) — new BE service layer + new model + new throttle subclass.
3. `security-auditor` (`comprehensive-review`) — ORS POST exposure (SSRF still impossible — base-URL allowlist holds), throttle config (per-user keying verified), `TripRouteCache` data retention question (payload contains coords but no PII).
4. `ui-visual-validator` (`accessibility-compliance`) — `<dl>` semantics across PLANNED/PLANNING/FAILED, status badge contrast, target sizes on the in-Empty link, mobile layout for the compact Route side row.
5. `performance-engineer` (`application-performance`) — TanStack Query response shape delta; build emits NO `leaflet` chunk (confirms the deferral); no bundle regression for `/trips/:id`.

Resolve every CRITICAL before merge. Defer L1/M findings as `## Open questions` updates with written justifications.

### Step 10 — Tracker + architecture updates (last commits)

- `context/architecture.md#Storage Model` — replace the spec-03 "stub stage" wording for the `trips` table; document the four new route fields + the future-lift path to a sibling `TripRoute` table when re-planning ships. Add a `TripRouteCache` row to the storage model with the SHA256-keyed shape. Add the `ScopedRateThrottle` config to `#Auth and Access Model` or a new `#Rate limiting` subsection (whichever fits cleaner).
- `context/progress-tracker.md` — record completion under `## Completed`; clear `## In Progress`; reshuffle `## Next Up` (HOS planner stays as the next feat; spec 06 = Leaflet map renderer with HOS overlays).

## File-level deliverables

```
apps/web-api/
└── web_api/
    ├── settings/base.py                                              # MODIFY: + DEFAULT_THROTTLE_CLASSES, + DEFAULT_THROTTLE_RATES
    ├── integrations/openrouteservice.py                              # MODIFY: + directions_hgv, + DirectionsResult/Segment/Summary, + window-stamped OrsRateLimitError, + POST in Retry.allowed_methods, docstring note
    ├── throttling.py                                                 # NEW: PerUserScopedThrottle keyed by request.user_id
    └── apps/
        ├── geocoding/views.py                                        # MODIFY: + throttle_scope on each view
        └── trips/
            ├── models.py                                             # MODIFY: TripStatus enum, route_* JSONFields + route_error_code, TripRouteCache model
            ├── services.py                                           # NEW: plan_trip + _build_cache_key + _CACHE_KEY_VERSION
            ├── views.py                                              # MODIFY: TripCreateView delegates; + throttle_scope
            ├── serializers.py                                        # MODIFY: TripResponseSerializer + route_* + route_error_code
            ├── migrations/0002_trip_route_fields_and_cache.py        # NEW (generated + RunPython for "pending" -> "planning")
            └── tests/
                ├── test_directions_client.py                         # NEW
                ├── test_trip_pipeline.py                             # NEW
                ├── test_throttling.py                                # NEW
                └── test_trips_views.py                               # MODIFY: assert route_* fields in retrieve response
                                                                       (note: spec-03 location may be apps/web-api/tests/ — preserve whichever exists)

apps/web-app/src/
├── features/trip-planner/
│   ├── api/
│   │   ├── trip-by-id.ts                                             # MODIFY: TripResponse discriminated union
│   │   └── plan-trip.ts                                              # MODIFY: response type widens
│   ├── schemas/
│   │   └── trip-response.ts                                          # NEW
│   ├── components/
│   │   ├── route-summary.tsx                                         # NEW
│   │   ├── route-summary.test.tsx                                    # NEW
│   │   ├── trip-detail-panel.tsx                                     # MODIFY: + compact Route SidebarGroup
│   │   └── trip-detail-panel.test.tsx                                # MODIFY
│   └── utils/
│       ├── format-duration.ts                                        # NEW
│       ├── format-duration.test.ts                                   # NEW
│       ├── format-distance.ts                                        # NEW
│       └── format-distance.test.ts                                   # NEW
├── app/routes/
│   ├── trips-detail.tsx                                              # MODIFY: status-branched main area via <RouteSummary>
│   └── trips-detail.test.tsx                                         # MODIFY (or add — depending on existing location)
└── testing/handlers.ts                                               # MODIFY: + mockTripPlanned/Failed/Planning + extended default

context/
├── architecture.md                                                   # MODIFY (post-implementation): Storage Model + Rate limiting
└── progress-tracker.md                                               # MODIFY (post-implementation, LAST commit)
```

No `pyproject.toml` change — `responses` / `pytest-httpx` are NOT added; `_session.post` is patched via `unittest.mock.patch`. No new frontend dependencies — Leaflet is deferred per decision 17. No `packages/ui` changes — every shadcn primitive used here is already installed (decision listed under Prerequisites).

## Existing functions / utilities to reuse (do not re-implement)

- `apps/web-api/web_api/integrations/openrouteservice.py::_session` + the four `OrsError` subclasses + `_ORS_BASE_URL` allowlist validator — extend, don't fork.
- `apps/web-api/web_api/exception_handler.exception_handler` — the `{"detail": str, "errors": {...} | null}` envelope.
- `apps/web-api/web_api/auth/authentication.py::ClerkAuthentication` — `request.user_id` is canonical; the new throttle subclass reads exactly this.
- `apps/web-api/web_api/apps/trips/serializers.py::TripResponseSerializer` (ModelSerializer) — extend `Meta.fields`; do not author a parallel serializer.
- `apps/web-api/tests/conftest.py::TripFactory` + `authenticated_client` + the Clerk `authenticate_request` patch.
- `apps/web-app/src/lib/api-client.ts::apiFetch` + `ApiError`.
- `apps/web-app/src/features/trip-planner/api/trip-by-id.ts::useTripById` — widen the response type; do not fork the hook.
- `apps/web-app/src/features/trip-planner/api/plan-trip.ts::usePlanTrip` — same.
- `packages/ui` shadcn primitives: `Card`, `CardContent`, `Badge`, `Empty`, `EmptyTitle`, `EmptyDescription`, `Skeleton`, `Alert`. All already installed; spec 04 adds zero new primitives.
- `packages/ui::SpotterLoader` for the `PLANNING` race fallback.

## Architecture invariants verified

- **#1 (HOS planner pure Python)** — untouched in spec 04.
- **#3 (no raw ORS calls from browser)** — Directions, like geocoding, originates from `web-api`. The API key never reaches the client.
- **#5 (ownership-checked mutations)** — `TripCreateView` already stamps `user_id = request.user_id`; the new `plan_trip` service preserves this. `TripRetrieveView` 404 (not 403) on foreign trips also preserved.
- **#7 (theme tokens only)** — `RouteSummary` uses `bg-card / text-foreground / text-muted-foreground / border-border / bg-destructive` semantic tokens. No hex literals; no `bg-*-500`-style raw Tailwind colors.
- **#8 (no custom sub-agents)** — all five reviewers come from the wshobson/agents marketplace.
- **#9 (specs drive implementation)** — this is the spec.

## Sub-agents to invoke

| Agent (plugin)                                     | When                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `architect-review` (`comprehensive-review`)        | **First — against the SPEC TEXT** before implementation begins. Catches design drift before code locks it in. Then again against the diff. |
| `code-reviewer` (`comprehensive-review`)           | Mandatory before PR.                                                                                                                       |
| `security-auditor` (`comprehensive-review`)        | Required — ORS POST exposure, throttle config, `TripRouteCache` data retention.                                                            |
| `ui-visual-validator` (`accessibility-compliance`) | Required — new `<dl>` surface across three status branches, badge contrast, side-panel route row.                                          |
| `performance-engineer` (`application-performance`) | Required — TanStack Query response delta; confirm zero bundle bloat (Leaflet still deferred).                                              |
| `typescript-pro` (`javascript-typescript`)         | Recommended — discriminated union + zod refinement patterns.                                                                               |
| `python-pro` + `django-pro` (`python-development`) | Recommended — service layer + migration RunPython + throttle subclass.                                                                     |

Auto-trigger: `react-architecture`, `react-doctor` (every `.tsx`), `django-expert` (every `.py` under `apps/web-api/`).

## Citations to include inline (or in PR body)

- ORS Directions endpoint + GeoJSON variant: <https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types>
- ORS routing options (preference/units/profile_params): <https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options>
- ORS Authorization header form (verbatim, not `Bearer`): <https://ask.openrouteservice.org/t/api-call-setup-question/4984>
- ORS quota + `x-ratelimit-*` headers: <https://giscience.github.io/openrouteservice/frequently-asked-questions.html>
- ORS error response shape: <https://github.com/GIScience/openrouteservice-docs/blob/master/API%20V2/swagger.json>
- DRF `ScopedRateThrottle` + `UserRateThrottle.get_cache_key` (the `cache_format` template we reuse): <https://www.django-rest-framework.org/api-guide/throttling/>
- Django `RunPython` operations + reversibility: <https://docs.djangoproject.com/en/5.2/ref/migration-operations/#runpython>
- TanStack Query v5 discriminated response shapes (general pattern): <https://tanstack.com/query/v5/docs/framework/react/typescript>
- zod `discriminatedUnion`: <https://zod.dev/?id=discriminated-unions>
- WAI-ARIA description list pattern (semantic `<dl>` + `<div role="group">` blocks): <https://www.w3.org/WAI/ARIA/apg/patterns/grid/>
- WCAG 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum>
- Architecture invariants verified against: `context/architecture.md`
- UI anti-patterns derived from: this spec's planning session, recorded under "Decisions of record" and the dedicated section below.

Third-party versions verified at PR-write time via `npm view <pkg> version` and `curl pypi.org/pypi/<pkg>/json` where relevant; resolved versions recorded in the PR body.

## UI anti-patterns to avoid

The user's spec-04 planning directive — "right components for each case", "no duplicate titles", "no over-explaining", "no dead code or irrelevant comments" — translates into these concrete prohibitions for this surface:

1. **NO `<CardHeader>` / `<CardTitle>` / `<CardDescription>` on the route-summary card.** The sticky page header already says "Trip workspace"; a second title duplicates.
2. **NO per-segment `<Card>`.** The per-leg rows live in the same `<dl>` as the hero metrics; a Card per leg implies the legs are independent resources — they aren't.
3. **NO "coming soon: map" placeholder under the summary.** Spec 06 ships the map. Until then, the summary stands alone as a complete artifact, not a teaser.
4. **NO `<SpotterLoader>` on the PLANNED path.** The mutation already settled before navigation; TanStack Query has the data. Only the rare PLANNING race shows the loader.
5. **NO retry button on FAILED.** Retry is spec 09 territory (Saved Trips list with per-row retry). FAILED shows the human-readable reason + "Plan a new trip" link only.
6. **NO duplicated status badge.** Status appears ONCE in the side panel — not also in the main route-summary card. Surface separation matters.
7. **NO `lucide-react` icon decoration on metric labels.** Pure typography; `<dt>` carries meaning. Icons would read as chrome and break the dense-pro-tool aesthetic.
8. **NO unused exports.** Every export named in this spec has a callsite within the unit. Untouched exports are noise (`context/code-standards.md` line 11).
9. **NO comments that restate the code.** Names carry meaning. Comments only for the _why_ — a hidden constraint, a non-obvious invariant, a workaround.
10. **NO `bg-blue-500`-style raw Tailwind colors.** Semantic tokens only (`bg-card`, `text-foreground`, `border-border`, `bg-destructive`). No hex literals.

## Verification (the unit is not done until every box is ticked)

- [ ] `pnpm exec turbo run lint typecheck test build --filter=web-app --filter=@outbound/ui` is green.
- [ ] `pnpm format:check` is green.
- [ ] `cd apps/web-api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest` is green.
- [ ] CI grep enforcing `web_api/hos/` purity still passes (HOS module untouched in spec 04).
- [ ] Migration 0002 applies cleanly to a FRESH SQLite test DB AND to the local Postgres `outbound_dev` (which has the spec-03 `"pending"` row). Reverse migration restores the prior shape on the local DB.
- [ ] Build output: `pnpm exec turbo run build --filter=web-app` emits NO `leaflet` chunk (confirms the deferral).
- [ ] No hex literals or raw `bg-*-500`-style Tailwind colors in any file under `apps/web-app/src/{components,features}/`. Semantic tokens only.
- [ ] Manual browser smoke (Step 8) walks the golden trip on mobile 375×667 + desktop 1440×900. Screenshots in PR body for PLANNED + FAILED + cache-hit confirmation.
- [ ] Cache-hit smoke: second identical POST shows no outbound ORS call in the `runserver` log (or via network inspector). `TripRouteCache` count = 1 after both POSTs.
- [ ] Throttle smoke: rapid POSTs from one Clerk user exceed the 30/hour rate → 31st returns 429 with the standard `{detail, errors}` envelope.
- [ ] `code-reviewer`, `architect-review`, `security-auditor`, `ui-visual-validator`, `performance-engineer` have reviewed the diff; no unresolved CRITICAL findings.
- [ ] Branch `feat/04-ors-directions-trip-pipeline`; PR base `develop`.
- [ ] `.github/pull_request_template.md` filled verbatim; Conventional Commit subjects; no `Co-Authored-By` trailer; no `--no-verify`.
- [ ] `context/architecture.md` updated with the new route fields + `TripRouteCache` row + rate-limiting subsection.
- [ ] `context/progress-tracker.md` updated as the **last** committed file — spec 04 → Completed; Next Up updated (HOS planner stays queued; Leaflet map moves to spec 06).

## Out of scope (deliberate — don't touch in this unit)

- HOS planner module + golden tests → spec 05.
- Leaflet + react-leaflet renderer → spec 06.
- ELD Daily Log SVG renderer → spec 07.
- PDF export → spec 08.
- Saved Trips list + per-row retry → spec 09.
- Apple OAuth, account settings, i18n, magic-link sign-in, MFA — already deferred.
- `web-auth` cosmetic changes, `web-api/auth/` middleware tweaks, CI workflow edits.
- Reverse geocoding `/api/geocode/reverse/` — deferred from spec 03 as `feat/<NN>-current-location`.
- `packages/ui` primitives — none added in this spec.
- ORS response caching beyond the per-trip `TripRouteCache` (e.g., a Redis layer) — not in v1.

## Open questions

None blocking at write time. Three known-unknowns documented for the implementer (resolve inline + record in progress-tracker if encountered):

- **403 vs 401 from ORS Directions.** The verified docs say 403 covers both daily quota and authentication failures; the message-text match in decision 7 is the discrimination. If ORS ever returns 401 instead, treat the same as the non-quota 403 case (`OrsRequestError`, auth/config — operator attention required).
- **`TripRouteCache.payload` size.** The polyline for a transcontinental trip (e.g., LA → NY) returns ~5000–10000 coordinate pairs, ~100–200 KB JSON. Postgres `JSONField` handles this fine; the size only matters if a future migration adds a unique constraint on `payload` (it shouldn't). If row size approaches 1 MB, revisit.
- **Per-hour throttle test ergonomics.** Pytest can't easily wait an hour; `tests/test_throttling.py` uses `override_settings` to lower the rate (e.g., `"trip_create": "3/min"`) during the test and verifies the 4th call returns 429. The production-rate behavior is verified by inspecting the rate string at startup + asserting the cache key shape.
