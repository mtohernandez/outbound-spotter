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

- `apps/web-app/` — trip-planner SPA. Owns the trip form, map, log SVG renderer, PDF export, saved-trip browser. Never talks to ORS directly; always proxies through web-api so the ORS API key stays server-side.
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
  - `trips` (UUID id, Clerk `user_id` string, three flat address triples `(current|pickup|dropoff)_(label,lat,lon)`, `cycle_hours_used` Decimal(3,1), `status` Char(16) default `"pending"`, `created_at` auto). Index on `(user_id, -created_at)`. **Stub stage** (spec 03); spec 04 extends with `route_polyline`, `route_segments`, `route_summary`.
  - `users` (Clerk user id + display name) — not yet materialised; the Clerk JWT `sub` is the canonical user id today and rows are stamped directly with it.
  - `trip_stops` (typed stops with lat/lon + sequence), `log_events` (one row per duty-status change), `log_days` (per-24h rollup) — land with spec 06+ once the HOS planner exists.
- **No blob storage in v1.** PDFs are generated client-side and never persisted server-side.
- **No cache layer in v1.** ORS responses for the same input triple are cached in Postgres against a SHA256 of the request to avoid burning the ORS daily quota during the review.

## Auth and Access Model

- Every authenticated session is a Clerk session.
- **web-auth** is the only origin that renders sign-in / sign-up. It uses `@clerk/react` (Core 3) and shadcn auth blocks for the visual layer. The unified `<Show when="signed-in" />` and `<Show when="signed-out" />` primitives replace the legacy `<SignedIn>` / `<SignedOut>` components.
- **web-app** loads `@clerk/react` for session state only (`useUser`, `useAuth`, `<Show>`). If signed out, it redirects to `auth.<host>`.
- **web-api** validates incoming requests against Clerk's JWKS via `clerk-backend-api` (Python SDK). The decoded `sub` is the canonical user id, attached to `request.user_id` by middleware.
- Every mutating endpoint checks ownership: a user can only read / write trips they own. There is no admin role in v1.
- The publishable key lives in `VITE_CLERK_PUBLISHABLE_KEY` (web-app, web-auth). The secret key lives only in Fly.io secrets for web-api.

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

1. **The HOS planner is a pure function.** No Django, ORM, or HTTP imports inside `web_api/hos/`. Anything Django needs from it goes through a thin adapter.
2. **Every duty-status change writes a `LogEvent` row.** The UI is never the source of truth for log content — it renders what the API stored.
3. **No raw ORS calls from the browser.** The ORS API key never reaches the client.
4. **No client-side HOS math.** web-app renders log events; it does not decide where breaks go.
5. **Every mutation checks ownership.** A request without a valid Clerk JWT, or for a trip the JWT subject does not own, returns 401 / 403.
6. **PDF export is client-only.** No headless Chromium in production. The PDF is the same SVG the user already sees.
7. **Theme tokens are the only color / typography surface.** No hex literals or hardcoded font names in components; everything resolves from the Tailwind v4 `@theme` block defined per `docs/theme.md`.
8. **No custom sub-agents.** All sub-agents come from the `claude-code-workflows` marketplace (wshobson/agents). Skills live under `.agents/skills/` and are surfaced via the `.claude/skills` symlink.
9. **Specs drive implementation.** No code lands without a `context/specs/NN-*.md` file. The build plan (`context/specs/00-build-plan.md`) is authored before the first unit.
