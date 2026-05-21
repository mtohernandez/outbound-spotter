# Architecture Context

## Stack

Each version below was pinned to the latest stable release at the time of selection, verified against npm / PyPI / official release notes. Where a pin matters for runtime compatibility (Node LTS, Django LTS, Postgres major) the rationale is noted inline. The bump policy: **update this table first**, then the manifests in the same spec.

| Layer                 | Technology                                                                                  | Role                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node runtime          | Node 24 LTS (Active LTS, Krypton — supported through 2028-04)                               | Workspace tooling, build, dev servers. Stay on Active LTS, not Current.                                                                             |
| Package manager       | pnpm 11                                                                                     | Workspace + dependency management                                                                                                                   |
| Monorepo              | Turborepo 2.9.x                                                                             | Task pipeline, caching, --filter / --affected runs                                                                                                  |
| web-app               | Vite 8.0.x + React 19.2.x + TypeScript 6.0.x                                                | Trip-planner SPA — form, map, log SVGs, PDF export                                                                                                  |
| web-auth              | Vite 8.0.x + React 19.2.x + TypeScript 6.0.x                                                | Clerk-backed auth UI (custom shadcn-blocks login / signup / account screens)                                                                        |
| UI                    | shadcn/ui (latest CLI) + Tailwind v4.3.x (CSS-first @theme)                                 | Component library + design tokens (Geologica headings / DM Sans body)                                                                               |
| Frontend architecture | Bulletproof React (`src/features/*` own routes + api + state)                               | Feature ownership, no cross-feature imports                                                                                                         |
| Map                   | Leaflet 1.9.4 + react-leaflet 5 + OpenStreetMap tiles                                       | Render route + stop markers (Leaflet 2 still alpha — stay on the 1.9 line)                                                                          |
| Routing               | OpenRouteService Directions API v2, `driving-hgv` profile                                   | Truck-aware driving directions + distance + duration (free tier: 2000 req/day, 40 req/min)                                                          |
| Geocoding             | OpenRouteService Pelias                                                                     | Address → lat/lon                                                                                                                                   |
| Auth                  | Clerk Core 3 (`@clerk/react` v6.x) + `clerk-backend-api` (Python)                           | Session, JWT, account management — used by both web-app (client SDK) and web-api                                                                    |
| Python runtime        | Python 3.13                                                                                 | Django + HOS planner                                                                                                                                |
| web-api               | Django 5.2 LTS + Django REST Framework 3.17.x                                               | Trip CRUD, HOS planner, ORS proxy, JWT verification. LTS chosen over the latest non-LTS stable for the multi-year support window (through 2028-04). |
| Database              | PostgreSQL 17 (Docker dev, Fly Postgres prod) + psycopg 3.3.x                               | Users, Trips, Stops, LogEvents                                                                                                                      |
| Server data           | TanStack Query v5 + React Hook Form v7 + zod v4                                             | Server-state cache, forms, schema validation                                                                                                        |
| Testing               | pytest 9 + pytest-django 4.12 + factory_boy 3 (backend); Vitest 4 + RTL 16 + MSW (frontend) | Unit + API integration; golden HOS scenarios                                                                                                        |
| PDF export            | svg2pdf.js 2 + jsPDF 4 (browser)                                                            | Concatenate per-day log SVGs into a single downloadable PDF                                                                                         |
| Toasts / icons        | sonner 2 + lucide-react v1                                                                  | Notifications, iconography (shadcn defaults)                                                                                                        |
| Deployment            | Vercel (web-app, web-auth) + Fly.io (web-api + Postgres)                                    | Free-tier hosting                                                                                                                                   |
| Python deps           | uv (Astral)                                                                                 | Virtualenv + dependency manager for web-api (replaces pip + venv + pip-tools)                                                                       |
| Tooling               | ESLint + Prettier (TS) · Ruff + mypy 1.20 (Py) · dotenv-cli · tsx                           | Lint, format, type-check across both ecosystems. mypy pinned to 1.x until django-stubs supports 2.x.                                                |

## System Boundaries

- `apps/web-app/` — trip-planner SPA. Owns the trip form, map, log SVG renderer, PDF export, saved-trip browser. Never talks to ORS directly; always proxies through web-api so the ORS API key stays server-side. **`<TripMap />` is `React.lazy`-loaded from `/trips/:id` only**; Vite's natural lazy-import chunking pulls `leaflet` + `react-leaflet` + `@react-leaflet/core` + `leaflet/dist/leaflet.css` into a dedicated `trip-map-*.js` (~160 KB raw / 48 KB gzip) + `trip-map-*.css` (~15 KB raw / 6 KB gzip) chunk. Non-`/trips/:id` routes never load the leaflet bundle. A previously-tried explicit `manualChunks` carve-out for `leaflet-vendor` caused Rolldown to hoist shared React deps into the leaflet chunk via cross-chunk imports — the natural lazy-import split is correct (spec 07 perf-engineer CRITICAL).
- `apps/web-auth/` — Clerk-rendered auth pages styled with shadcn blocks. Issues the Clerk session that both web-app and web-api consume. Owns nothing trip-related.
- `apps/web-api/` — Django + DRF service. Owns the HOS planner (a pure Python module under `web_api/hos/`), the ORS client, all DB writes, and JWT verification via Clerk's JWKS.
- `apps/web-api/web_api/hos/` — pure-Python HOS calculator. No Django imports. Inputs: route legs + cycle-hours-used + start time. Outputs: a deterministic list of `LogEvent` dataclasses. This is the accuracy-critical surface and must stay framework-free so it's trivially testable.
- `packages/` — reserved for shared TS (types generated from DRF OpenAPI, shared shadcn primitives, shared ESLint/TS config). Empty until a real consumer appears (no premature abstraction).
- `context/` — product, architecture, and standards source-of-truth. Read by every Claude session via `CLAUDE.md`.
- `docs/` — reference material: FMCSA HOS guide, the assessment brief, theme tokens, example log images. Read-only.
- `.claude/agents/` — empty; **all** sub-agents come from the `claude-code-workflows` marketplace (sourced from the `wshobson/agents` GitHub repo) declared in `.claude/settings.json#extraKnownMarketplaces`.
- `.agents/skills/` — installed skills (symlinked into `.claude/skills/`).

## Storage Model

- **PostgreSQL** owns:
  - `trips` (UUID id, Clerk `user_id` string, three flat address triples `(current|pickup|dropoff)_(label,lat,lon)`, `cycle_hours_used` Decimal(3,1), `route_polyline` JSONField (list of `[lon, lat]` pairs), `route_segments` JSONField (per-leg `{distance_mi, duration_s, from_index, to_index}`), `route_summary` JSONField (`{distance_mi, duration_s}`), `created_at` auto). Index on `(user_id, -created_at)`. **A row exists ⇔ the route was successfully resolved by ORS**: `TripCreateView` validates the route BEFORE persisting and propagates routing failures as HTTP 4xx/5xx so no row is ever created on rejection. **Future lift**: when spec 09 ships per-trip re-planning, the route fields move to a sibling `trip_route_versions` table keyed `(trip_id, version)` so each retry persists.
  - `trip_route_cache` (PK `cache_key` CharField(64) = SHA256 hex of `f"v1|driving-hgv|recommended|mi|{lon:.5f},{lat:.5f}|…"`, `coords_canonical` CharField(255) denormalized for operator inspection, `payload` JSONField storing `dataclasses.asdict(DirectionsResult)`, `created_at` auto). No additional index — PK lookup. No TTL — eviction is "bump `_CACHE_KEY_VERSION` in `web_api/apps/trips/services.py`".
  - `users` (Clerk user id + display name) — not yet materialised; the Clerk JWT `sub` is the canonical user id today and rows are stamped directly with it.
  - `trip_stops` (UUID id, `trip_id` FK→`trips` CASCADE, `kind` CharField(16) in `{pickup, dropoff, fuel, break, sleeper, restart}`, `sequence` PositiveSmallInt, `polyline_index` PositiveInt, `lat`/`lon` Decimal(9,6), `label` CharField(128), `scheduled_at` DateTime, `duration_s` PositiveInt). Index on `(trip, sequence)`; unique on the same. The driver-facing marker payload spec 07 draws on the map.
  - `log_events` (UUID id, `trip_id` FK→`trips` CASCADE, `sequence` PositiveSmallInt, `status` CharField(32) in `{off_duty, sleeper_berth, driving, on_duty_not_driving}`, `start` DateTime, `duration_s` PositiveInt, `location` CharField(128), `note` CharField(255)). Two indexes: `(trip, sequence)` and `(trip, start)`. Unique on `(trip, sequence)`. One row per duty-status change (invariant #2).
  - `log_days` (UUID id, `trip_id` FK→`trips` CASCADE, `date` Date in home-terminal-local TZ, four per-status `*_s` PositiveInt fields, `total_miles` Decimal(7,1)). Index + unique on `(trip, date)`. Denormalised at write time by `hos_adapter.materialize_plan`; midnight-crossing events split their seconds + miles across two `log_days` rows so spec 08's §395.8 grid header sums correctly.
  - **`Trip.start_at`** (DateTime, tz-aware) — driver-chosen shift start. Required at create time; migration 0004 backfills any pre-spec-06 row from `created_at` via `Coalesce("created_at", Now())`.
  - **Plan-table invariant (spec 06):** every `trips` row that exists has matching `trip_stops` + `log_events` + `log_days` rows. `services.plan_trip` wraps `Trip.objects.create` AND `hos_adapter.materialize_plan(trip)` in one `transaction.atomic` block; any failure (ORS error, planner `ValueError`, DB constraint) rolls back the entire write so no half-resolved Trip persists. The view layer maps each failure mode to its HTTP envelope (4xx/5xx) and the FE keeps form state.
  - `trip_exports` (UUID id, Clerk `user_id` string, `trip_id` FK→`trips` `SET_NULL` `null=True`, denormalized `trip_current_label` / `trip_pickup_label` / `trip_dropoff_label` CharField(255), `mode` CharField(16) in `{multi_page, single_page}` (snake_case at DB layer; serializer translates to kebab-case on the wire), `sheet_count` PositiveSmallInt, `created_at` auto). Index on `(user_id, -created_at)` and `(trip,)`; ordering `(-created_at,)`. **Metadata-only audit row written when the user clicks Export PDF; the PDF blob is never persisted server-side per invariant #6.** `SET_NULL` (not CASCADE) + denormalized labels ensure audit history survives trip deletion; the FE `Recreate` action returns a graceful-degradation toast when `trip_id` is null.
- **No blob storage in v1.** PDFs are generated client-side and never persisted server-side; `trip_exports` stores metadata only.
- **ORS response cache (`trip_route_cache`)** is the only cache layer in v1; it backstops the HeiGIT 2000/day Directions quota during the assessment review.

## Auth and Access Model

- Every authenticated session is a Clerk session.
- **web-auth** is the only origin that renders sign-in / sign-up. It uses `@clerk/react` (Core 3) and shadcn auth blocks for the visual layer. The unified `<Show when="signed-in" />` and `<Show when="signed-out" />` primitives replace the legacy `<SignedIn>` / `<SignedOut>` components.
- **web-app** loads `@clerk/react` for session state only (`useUser`, `useAuth`, `<Show>`). If signed out, it redirects to `auth.<host>`.
- **web-api** validates incoming requests against Clerk's JWKS via `clerk-backend-api` (Python SDK). The decoded `sub` is the canonical user id, attached to `request.user_id` by middleware.
- Every mutating endpoint checks ownership: a user can only read / write trips they own. There is no admin role in v1.
- The publishable key lives in `VITE_CLERK_PUBLISHABLE_KEY` (web-app, web-auth). The secret key lives only in Fly.io secrets for web-api.

## Rate limiting

- `web_api.throttling.PerUserScopedThrottle` (subclass of DRF's `ScopedRateThrottle`) keys throttle buckets on `request.user_id` (the Clerk JWT `sub`), not on `request.user` (which is `AnonymousUser` under our JWT-only auth, and would collapse NAT'd users into one bucket).
- Wired via `REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]` + `DEFAULT_THROTTLE_RATES`:
  - `geocode_autocomplete = 60/min` (`GeocodeAutocompleteView`).
  - `geocode_search = 20/min` (`GeocodeSearchView`).
  - `geocode_reverse = 30/min` (`GeocodeReverseView`, spec 11b). Powers the "Use my current location" UX — gesture-bursty (one click → one call), sits between autocomplete (high-volume typeahead) and search (committal lookup).
  - `trip_create = 30/hour` (`TripCreateView`). 30 × 24 ≈ 720 worst-case, well under the HeiGIT 2000/day cap with the `trip_route_cache` short-circuit handling repeated input.
  - `trip_plan_retrieve = 120/min` (`TripPlanView`). Spec 07 will poll `GET /api/trips/<uuid:id>/plan/` on tab focus via TanStack Query; 2/sec sustained covers an aggressive user without becoming an oracle. The plan is immutable post-creation in v1, so a `Cache-Control: private, max-age=60` follow-up could absorb most refetches at the browser layer.
  - `export_create = 60/hour` (`TripExportListCreateView` POST). Mirrors `trip_create`'s density (≈ 1/min sustained); audit-row writes are cheap but rate-limited to keep storage growth predictable and to bound noisy log spam.
  - `export_list = 60/min` (`TripExportListCreateView` GET). Mirrors `trip_list` exactly.
  - `export_delete = 20/min` (`TripExportDestroyView` DELETE). Mirrors `trip_delete` exactly.
- Storage backend: Django's default cache (LocMem in dev, single-process). **Production deployment must back DRF's cache with Redis** before scaling beyond one gunicorn worker, otherwise each worker keeps its own counter.

## External integrations

### OpenRouteService (HeiGIT)

- Base URL: `https://api.openrouteservice.org`
- Directions endpoint: `POST /v2/directions/{profile}` (we use `profile = driving-hgv`)
  - Request: `Content-Type: application/json`, `Authorization: <api_key>` (header), body `{ "coordinates": [[lon, lat], …], "instructions": false, "preference": "recommended", "units": "mi" }`. Accept `application/geo+json` for GeoJSON output.
  - Response (GeoJSON): `features[0].geometry.coordinates` (route polyline as `[lon, lat]` pairs), `features[0].properties.summary.distance` (meters or chosen unit), `summary.duration` (seconds), `properties.segments` (per-leg breakdown).
- Geocoding endpoint: `GET /geocode/search?text=<query>&boundary.country=US` (Pelias).
- Free tier (HeiGIT standard plan): **2,000 directions requests / day**, **40 requests / minute**. The Postgres cache (`trip_route_cache`, keyed by `sha256(current|pickup|dropoff|cycle_hours)`) backstops the quota during the assessment review.
- ORS calls **always** originate from web-api. The browser never sees the key.

### Clerk JWKS

- web-api fetches and caches Clerk's JWKS (rotated by Clerk). `clerk-backend-api` handles caching + verification — never write a hand-rolled JWT verifier.

## Invariants

1. **The HOS planner is a pure function.** No Django, ORM, or HTTP imports inside `apps/web-api/web_api/hos/`. Anything Django needs from it goes through a thin one-way adapter at `apps/web-api/web_api/apps/trips/hos_adapter.py` — the adapter imports `web_api.hos`, but `web_api.hos.*` does NOT import the adapter. The cross-module note-string contract (planner emits `LogEvent.note` strings the adapter classifies via `_NOTE_TO_KIND`) is pinned by `apps/web-api/tests/hos/test_note_contract.py`. Public API: `plan_logs(inputs: PlannerInputs) -> list[LogEvent]`. Enforced by `apps/web-api/tests/hos/test_boundary.py`, which AST-walks the module and asserts every import lives in the allowlist below. Imports are restricted to:

   ```python
   # senior-review-hook: any addition to this set requires architect-review re-approval
   # and a synchronized update to apps/web-api/tests/hos/test_boundary.py — do NOT edit unilaterally.
   ALLOWED_TOP_LEVEL = {
       "datetime", "dataclasses", "enum", "decimal",
       "zoneinfo", "math", "typing", "collections.abc",
       "web_api.hos", "web_api.integrations.openrouteservice",
       "__future__",
   }
   ```

   `web_api.integrations.openrouteservice` is a data-contract import only — `DirectionsResult` / `DirectionsSegment` / `DirectionsSummary` must be imported under `if TYPE_CHECKING:` (the upstream module pulls Django + requests at module top, so a runtime import would silently break the planner's stdlib-only contract). `_smoke.py` is the one boundary-exempt file inside the module (it is not transitively imported by the planner's library path); see the inline comment in `test_boundary.py`.

2. **Every duty-status change writes a `LogEvent` row.** The UI is never the source of truth for log content — it renders what the API stored. Midnight-crossing events stay as ONE `log_events` row (the duty-status change happens once); only the per-day rollup in `log_days` is split across calendar dates by `hos_adapter._attribute_to_days`.
3. **No raw ORS calls from the browser.** The ORS API key never reaches the client.
4. **No client-side HOS math.** web-app renders log events; it does not decide where breaks go.
5. **Every mutation checks ownership.** A request without a valid Clerk JWT, or for a trip the JWT subject does not own, returns 401 / 403.
6. **PDF export is client-only.** No headless Chromium in production. The PDF is the same SVG the user already sees. PDF generation runs in the same browser session that rendered the SVG; the user's machine is the only PDF source. **Spec 10 strengthens this**: `trip_exports` records that an export occurred (mode, sheet_count, denormalized trip labels, timestamp) but **the PDF bytes are never persisted server-side**. `TripExport.delete` removes only the audit row; the user-side PDF file is untouched. Per-trip audit rows survive trip deletion via `on_delete=SET_NULL` + denormalized labels (CASCADE was rejected so history persists past `Trip` deletion).
7. **Theme tokens are the only color / typography surface.** No hex literals or hardcoded font names in components; everything resolves from the Tailwind v4 `@theme` block defined per `docs/theme.md`.
8. **No custom sub-agents.** All sub-agents come from the `claude-code-workflows` marketplace (wshobson/agents). Skills live under `.agents/skills/` and are surfaced via the `.claude/skills` symlink.
9. **Specs drive implementation.** No code lands without a `context/specs/NN-*.md` file. The build plan (`context/specs/00-build-plan.md`) is authored before the first unit.
