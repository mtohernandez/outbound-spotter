# 12 — Production Deployment (Vercel + Neon)

> Ships specs 01–11 to production on a single platform pair: **Vercel** (four projects, one per app) + **Neon** (managed Postgres, free tier). Resolves the assessment-readiness gap that "the reviewer can hit four real URLs and exercise the full feature set." Replaces the originally-planned Fly.io target after Fly Managed Postgres lost its free tier (now $38/month Basic) and Vercel's official Django framework preset (verified 2026-04-09 at <https://vercel.com/docs/frameworks/full-stack/django>) consolidated hosting onto one provider.

## Goal

After spec 12 ships:

1. **The assessment reviewer can hit four production URLs documented in `README.md#Production`** and exercise: apex redirect (signed-out → accounts), sign-in, trip creation (real ORS), trip retrieval, PDF export, sign-out.
2. **A `chore/12-production-deployment` branch lands on `develop`** with all code/infra changes (Dockerless — no Dockerfile needed since Vercel auto-detects Django via `manage.py`). A subsequent `release/0.1.0` PR merges develop → main and tags `v0.1.0`.
3. **CI/CD is the existing Vercel git integration** — each of the four Vercel projects auto-deploys on `main` push. There is no GitHub Actions deploy YAML to write or maintain.
4. **HOS planner remains pure Python** (invariant #1 untouched), the ORS key never reaches the browser (invariant #3), no client-side HOS math (invariant #4), every mutation checks ownership (invariant #5), PDF export is client-only (invariant #6), theme tokens only (invariant #7).

A new architecture entry lands: `apps/web-apex/` is a tiny Vite + React app hosted at the bare apex domain that performs the signed-in / signed-out redirect via Clerk's satellite-domain handshake. This is a deliberate boundary addition to `context/architecture.md#system-boundaries` — the apex needed its own surface because mixing it with web-auth would conflate responsibilities and force `accounts.<host>` to also serve the redirect logic.

## Architecture invariants check

From `context/architecture.md#invariants`, held against this spec:

- **#1 (HOS planner pure)** — zero touch on `apps/web-api/web_api/hos/`. The new `web_api.apps.health` app is mounted at `/api/` but does not import or invoke the planner. The `tests/hos/test_boundary.py` AST walker continues to pass verbatim.
- **#2 (every duty-status change writes a LogEvent row)** — read-only consumer; no LogEvent shape change.
- **#3 (no raw ORS calls from the browser)** — strengthened by the satellite handshake: the browser still calls only `web-api` for ORS; the new apex app makes no API calls at all (single redirect render).
- **#4 (no client-side HOS math)** — the apex app contains no business logic.
- **#5 (ownership)** — `/api/healthz/` is the one new endpoint and is intentionally `AllowAny` + no throttle (it's a liveness probe). It executes `SELECT 1` and returns booleans; no rows are read or written.
- **#6 (PDF export client-only)** — preserved; no server-side PDF rendering introduced.
- **#7 (theme tokens only)** — the apex app's one component (`<Redirector />`) uses `bg-background` only; no hex literals; no manual `dark:` overrides.
- **#8 (no custom sub-agents)** — review uses `code-reviewer`, `architect-review`, `security-auditor` from the wshobson marketplace.
- **#9 (specs drive implementation)** — this file is the source of truth.

## Decisions of record (resolved at planning time)

Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-recursive-clover.md`. The user-facing decisions captured during plan-mode discussion 2026-05-21:

1. **Domain — Vercel + Fly defaults, no custom domain.** Four `*.vercel.app` URLs (see Production URLs table in `README.md`) and a Neon project. Custom domain is deferred to a later spec.

2. **Hosting — Vercel for everything, Neon for Postgres.** Vercel's Python runtime / Fluid Compute hosts Django natively in 2026 (verified at <https://vercel.com/docs/frameworks/full-stack/django>, last updated 2026-04-09). Fly.io is dropped because Fly Managed Postgres lost its free tier (Basic plan is $38/month per <http://fly.io/docs/mpg/> fetch 2026-05-21) and Vercel's Django support collapsed hosting onto one provider.

3. **Clerk — reuse existing development instance keys.** Production-mode satellites require a paid Clerk plan (cite <https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains>: "considered advanced" and "all features are free to use in development mode"). v0.1.0 traffic is bounded by the assessment review window. README explicitly flags this as a free-tier compromise.

4. **Merge flow — strict gitflow.** `chore/12-production-deployment` → develop → `release/0.1.0` → main; tag `v0.1.0`; merge release back into develop. Matches `CONTRIBUTING.md §5` verbatim.

5. **Apex redirector — new `apps/web-apex/` Vite + React app.** Three alternatives considered (static HTML, edge function, reuse web-auth); the Vite app keeps the monorepo's per-tenant-one-app symmetry, uses Clerk's SDK for the cookie / satellite handshake (more reliable than DIY cookie-sniffing), and deploys identically to the other Vite apps. ~150 LOC total.

6. **Tenant naming — `accounts.<host>` (not `auth.<host>`).** User-chosen subdomain. `context/architecture.md` + `context/project-overview.md` updated to the new name. The `web-auth` workspace name is unchanged — `accounts.` is the deployed hostname, not the workspace identity.

7. **Database — Neon (free tier).** 0.5 GB storage + 100 CU-hours/month + 10 branches + scale-to-zero after 5 min idle (not disable-able). Cite <https://neon.com/docs/introduction/plans> (fetched 2026-05-21). Always use the **pooled** connection string (`-pooler` in hostname) since Vercel functions are short-lived.

8. **Neon-Django settings.** `web_api/settings/prod.py` honours the Neon-Django guide (<https://neon.com/docs/guides/django>): `OPTIONS["sslmode"] = "require"`, `CONN_MAX_AGE = 240` (under Neon's 5-min idle suspend), `CONN_HEALTH_CHECKS = True`, `DISABLE_SERVER_SIDE_CURSORS = True`. psycopg's app-level `OPTIONS["pool"]` is dropped in prod (conflicts with Neon's pgbouncer).

9. **Migrations — Vercel build-time hook.** `[tool.vercel.scripts].build = "DJANGO_SETTINGS_MODULE=web_api.settings.prod python manage.py migrate --noinput"` in `apps/web-api/pyproject.toml`. Vercel runs this after `uv sync` and before sealing the function bundle; a failing migration fails the deploy (loud signal of misconfigured `DATABASE_URL`). `collectstatic` runs automatically — no need to add it to the build script (cite the Django-on-Vercel "Serving static assets" section).

10. **Static files — Vercel CDN, not WhiteNoise.** Vercel auto-collects static files at build and serves from the CDN. WhiteNoise stays in `MIDDLEWARE` so `vercel dev` works locally; in production it's a no-op behind the CDN.

11. **CI/CD — Vercel's git integration.** Each of the four projects connects to the GitHub repo with `rootDirectory: apps/<name>` and production branch `main`. Push to `main` triggers four production builds in parallel. No `.github/workflows/deploy.yml` is written — the existing `ci.yml` (lint / typecheck / test / build / commitlint / format check / ruff / mypy / pytest) is the gate.

12. **Apex redirector implementation.**
    - One component: `apps/web-apex/src/features/redirect/components/redirector.tsx` uses `useAuth()` from `@clerk/react`.
    - On `isLoaded` true: `window.location.replace(isSignedIn ? VITE_APP_URL : VITE_AUTH_SIGN_IN_URL)`. Hard navigation crosses the satellite boundary — React Router would be the wrong primitive.
    - Renders `<SpotterLoader />` (from `@outbound/ui/components/brand/spotter-loader`) during the handshake.
    - `<ClerkProvider isSatellite domain={VITE_APEX_URL} signInUrl={VITE_AUTH_SIGN_IN_URL}>` wraps it.
    - No router, no API calls, no persistence.

13. **Satellite topology (Clerk).**
    - **Primary** — `outbound-spotter-accounts.vercel.app` (web-auth). `<ClerkProvider allowedRedirectOrigins={[VITE_APP_URL, VITE_APEX_URL]}>` accepts handshakes from the two satellites.
    - **Satellites** — `outbound-spotter-app.vercel.app` (web-app) + `outbound-spotter.vercel.app` (web-apex). Each runs `<ClerkProvider isSatellite domain={own URL} signInUrl={primary/sign-in}>`.
    - All three apps share one `VITE_CLERK_PUBLISHABLE_KEY` value (same Clerk dev instance).

14. **Health check — two endpoints, distinct purposes.**
    - **`GET /healthz`** (root, no prefix) — pre-existing 200-OK ping with no DB; useful for cheap liveness checks.
    - **`GET /api/healthz/`** (new, via `web_api.apps.health`) — runs `SELECT 1` against the configured DB; returns `{"status": "ok", "db": true}` (200) or `{"status": "degraded", "db": false}` (503). Cited in `README.md#Production` as the reviewer-facing probe URL.

15. **`CSRF_TRUSTED_ORIGINS` is env-driven and prod-only.** Added to `WebApiSettings` (pydantic) with `default_factory=list`. Wired into Django only in `settings/prod.py`. The JWT-only API doesn't need CSRF for its primary surface, but Django itself requires the trusted-origins list for any session-derived view (admin, drf-spectacular swagger UI authenticated form).

## Files touched

### `apps/web-api/` (Django + Vercel adapter)

| File                              | Action | Purpose                                                                                  |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `vercel.json`                     | NEW    | `{"framework": "django"}` — explicit preset (Vercel also auto-detects via manage.py).    |
| `pyproject.toml`                  | MOD    | `[tool.vercel.scripts].build` hook for migrations.                                       |
| `web_api/settings/base.py`        | MOD    | `CSRF_TRUSTED_ORIGINS` field on `WebApiSettings`; `INSTALLED_APPS += health`.            |
| `web_api/settings/prod.py`        | MOD    | Neon-Django DB settings; stdout JSON `LOGGING`; `CSRF_TRUSTED_ORIGINS` from env.         |
| `web_api/urls.py`                 | MOD    | Mount `path("api/", include("web_api.apps.health.urls"))`; healthcheck docstring update. |
| `web_api/apps/health/__init__.py` | NEW    | Empty stub.                                                                              |
| `web_api/apps/health/apps.py`     | NEW    | `HealthConfig`.                                                                          |
| `web_api/apps/health/views.py`    | NEW    | `HealthzView(APIView)` with `AllowAny`, no throttle, DB `SELECT 1`.                      |
| `web_api/apps/health/urls.py`     | NEW    | `path("healthz/", HealthzView.as_view(), name="healthz")`.                               |
| `README.md`                       | MOD    | Prod env table; serverless implications; drop Fly references.                            |

### `apps/web-app/`

| File                   | Action | Purpose                                                    |
| ---------------------- | ------ | ---------------------------------------------------------- |
| `vercel.json`          | NEW    | Vite framework preset + SPA rewrites + turbo-filter build. |
| `src/app/provider.tsx` | MOD    | `<ClerkProvider isSatellite domain={VITE_APP_URL}>`.       |
| `src/config/env.ts`    | MOD    | Add `VITE_APP_URL` (own origin).                           |
| `README.md`            | MOD    | `VITE_APP_URL` row in env table.                           |

### `apps/web-auth/`

| File                   | Action | Purpose                                                                   |
| ---------------------- | ------ | ------------------------------------------------------------------------- |
| `vercel.json`          | NEW    | Vite framework preset + SPA rewrites + turbo-filter build.                |
| `src/app/provider.tsx` | MOD    | `<ClerkProvider allowedRedirectOrigins={[VITE_APP_URL, VITE_APEX_URL]}>`. |
| `src/config/env.ts`    | MOD    | Add `VITE_APEX_URL`.                                                      |
| `README.md`            | MOD    | `VITE_APEX_URL` row in env table.                                         |

### `apps/web-apex/` (new — minimal Vite app)

| File                                                         | Action |
| ------------------------------------------------------------ | ------ |
| `package.json`                                               | NEW    |
| `vite.config.ts`                                             | NEW    |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | NEW    |
| `eslint.config.js`                                           | NEW    |
| `index.html`                                                 | NEW    |
| `vercel.json`                                                | NEW    |
| `README.md`                                                  | NEW    |
| `src/main.tsx`                                               | NEW    |
| `src/app/app.tsx`                                            | NEW    |
| `src/app/provider.tsx`                                       | NEW    |
| `src/config/env.ts`                                          | NEW    |
| `src/features/redirect/components/redirector.tsx`            | NEW    |
| `src/styles/globals.css`                                     | NEW    |

### Context + docs

| File                                        | Action | Purpose                                                                                                  |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `context/architecture.md`                   | MOD    | web-apex boundary; Vercel + Neon stack table updates; `accounts.<host>`; Deployment topology subsection. |
| `context/project-overview.md`               | MOD    | `accounts.<host>` rename.                                                                                |
| `context/progress-tracker.md`               | MOD    | Spec 12 entry (last context file before commit per `ai-workflow-rules.md`).                              |
| `CLAUDE.md`                                 | MOD    | `apps/web-apex/` row in the "Where things live" tree.                                                    |
| `README.md` (root)                          | MOD    | Apps table; project layout; tech stack hosting; new "Production" section.                                |
| `context/specs/12-production-deployment.md` | NEW    | This spec.                                                                                               |

## Verification (gate before opening the develop PR)

- [ ] `pnpm install` succeeds (web-apex is picked up via the `apps/*` workspace glob in `pnpm-workspace.yaml`).
- [ ] `pnpm exec turbo run lint typecheck test build --affected` passes from repo root.
- [ ] `pnpm format:check` passes.
- [ ] `cd apps/web-api && uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest` passes. The HOS boundary test continues to pass — the new health app is verified to add no imports inside `web_api/hos/`.
- [ ] No new component contains a hex literal or hardcoded font name.
- [ ] `code-reviewer` (from `comprehensive-review`) has reviewed the diff and all CRITICAL findings are resolved.
- [ ] `architect-review` has reviewed the architecture.md updates and signed off on the new `apps/web-apex/` boundary + the Vercel/Neon stack swap.
- [ ] `security-auditor` has reviewed the CORS / CSRF / JWT trust changes.
- [ ] `context/progress-tracker.md` is the last context file updated and committed.

## Verification (gate before merging release/0.1.0 → main)

- [ ] PR title `release: v0.1.0` is a valid Conventional Commit.
- [ ] CI green on the release branch.
- [ ] Phase 12b complete: all four Vercel projects have prod env vars set (`vercel env ls --target=production` per project), the Neon project has the migration set applied (verified by hitting `/api/healthz/` and seeing `db: true`), and the Clerk dashboard has the satellite domains configured.
- [ ] `curl https://outbound-spotter-api.vercel.app/api/healthz/` returns 200 with `{"status":"ok","db":true}` from a fresh shell.
- [ ] Apex redirect, sign-in handshake, trip create, PDF export pass via Playwright (Phase 12c results pasted into the release PR body).
- [ ] No regression in the assessment-success-criteria scenarios (`context/project-overview.md:78-85`).

## Phase 12b — Bootstrap deploy (manual, post-develop-merge)

Commands run from repo root. Auth steps run via `!` prefix in the chat so the user sees the prompts.

```
# Neon
! neonctl auth
neonctl projects create --name outbound-spotter --region-id aws-us-east-2
# Capture pooled connection string

# Vercel — four projects, one per app
vercel link --yes --cwd apps/web-app  --project outbound-spotter-app
vercel link --yes --cwd apps/web-auth --project outbound-spotter-accounts
vercel link --yes --cwd apps/web-apex --project outbound-spotter
vercel link --yes --cwd apps/web-api  --project outbound-spotter-api

# Per-project env vars: see the section in `context/architecture.md#deployment-topology-v010`

# First deploys
vercel deploy --prod --cwd apps/web-api
vercel deploy --prod --cwd apps/web-app
vercel deploy --prod --cwd apps/web-auth
vercel deploy --prod --cwd apps/web-apex

# Clerk dashboard satellites (clerk CLI or dashboard)
# Primary: outbound-spotter-accounts.vercel.app
# Satellites: outbound-spotter-app.vercel.app, outbound-spotter.vercel.app
```

## Phase 12c — Production smoke tests

| Test                                                                                       | Expected                         |
| ------------------------------------------------------------------------------------------ | -------------------------------- |
| `curl -i https://outbound-spotter-api.vercel.app/api/healthz/`                             | 200, `{"status":"ok","db":true}` |
| `curl -i https://outbound-spotter-api.vercel.app/api/trips/`                               | 401 (no JWT)                     |
| Playwright: apex (signed-out) → redirect to `outbound-spotter-accounts.vercel.app/sign-in` | PASS                             |
| Playwright: sign in → redirect to `outbound-spotter-app.vercel.app/trips`                  | PASS                             |
| Playwright: apex (signed-in) → redirect to `outbound-spotter-app.vercel.app/trips`         | PASS                             |
| Playwright: create a trip (Richmond VA → Newark NJ, 0 cycle hrs) → ORS hits + logs render  | PASS                             |
| Playwright: refresh `/trips/<id>` → trip loads from Neon                                   | PASS                             |
| Playwright: export PDF → file downloads; `trip_exports` audit row exists                   | PASS                             |
| Playwright: sign out → redirect to `outbound-spotter-accounts.vercel.app/sign-in`          | PASS                             |
| Throttle: 65× `GET /api/geocode/autocomplete?text=ny` in 60s                               | 60 × 200 then 429                |

Failures get filed as `fix/12-*` follow-ups in `context/progress-tracker.md`.

## Open risks (named for the reviewer)

1. **Cold start on idle wake.** Vercel function cold start + Neon's 5-min scale-to-zero stack into a 1–3 s first request after quiet time. Documented in `README.md` "Production" section.
2. **500 MB bundle limit.** Verified by `vercel build --cwd apps/web-api` locally before pushing.
3. **No background workers.** v1 doesn't need them; documented as an architecture constraint.
4. **Function timeout 10 s on free Hobby.** Trip create (ORS warm + planner + DB writes) stays comfortably under; documented.
5. **Clerk dev keys in production.** README explicitly flags this and the upgrade path (custom domain + Clerk prod plan).
6. **`.vercel.app` Public Suffix List** — cookies don't share across subdomains; satellite handshake is required. Documented.

## Out of scope (deliberate)

- Custom domain + DNS.
- Production Clerk instance.
- Redis-backed throttle cache (spec 11 carry-forward).
- Sentry / monitoring.
- Multi-region deployment.
- Background workers.
