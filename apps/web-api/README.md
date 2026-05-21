# @outbound/web-api

<p align="center">
  <a href="../../LICENSE.md"><img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-008080?style=flat" /></a>
  <img alt="Stack" src="https://img.shields.io/badge/stack-Django%205.2%20LTS%20%C2%B7%20DRF-092e20?style=flat&logo=django&logoColor=white" />
  <img alt="Python" src="https://img.shields.io/badge/python-3.13-3776ab?style=flat&logo=python&logoColor=white" />
  <img alt="Port" src="https://img.shields.io/badge/port-8000-3D9296?style=flat" />
</p>

The Django + DRF service. Owns the HOS planner, the OpenRouteService client, all DB writes, and Clerk JWT verification. Managed with [`uv`](https://docs.astral.sh/uv/).

## Overview

- **What lives here.** Trip CRUD, the HOS planner, the ORS proxy, the exports audit log, and Clerk JWT verification.
- **HOS planner is pure Python.** It lives under `web_api/hos/` and imports no Django, DRF, or HTTP code. The boundary is enforced by an AST-walking test in `tests/hos/test_boundary.py`.
- **ORS is server-only.** The OpenRouteService API key never reaches the browser. Every directions / geocoding call originates from `web_api/integrations/openrouteservice.py`.
- **PDF export is client-only.** This service records that an export happened (mode, sheet count, denormalized trip labels, timestamp) but never stores the PDF blob.

## API surface

| Path                         | Method | Purpose                                            | Throttle (per user) |
| ---------------------------- | ------ | -------------------------------------------------- | ------------------- |
| `/api/me/`                   | GET    | Returns the authenticated Clerk user.              | —                   |
| `/api/geocode/autocomplete/` | GET    | Address autocomplete (ORS Pelias proxy).           | 60 / min            |
| `/api/geocode/search/`       | GET    | Full address search (ORS Pelias proxy).            | 20 / min            |
| `/api/trips/`                | GET    | List the caller's trips, newest first.             | 60 / min            |
| `/api/trips/`                | POST   | Create a trip — geocodes, routes, and plans.       | 30 / hour           |
| `/api/trips/<uuid>/`         | GET    | Retrieve a single trip (owner only).               | —                   |
| `/api/trips/<uuid>/`         | DELETE | Delete a trip (owner only).                        | 20 / min            |
| `/api/trips/<uuid>/plan/`    | GET    | The planner output (stops + log events + days).    | 120 / min           |
| `/api/exports/`              | GET    | The caller's export audit history.                 | 60 / min            |
| `/api/exports/`              | POST   | Record that a PDF export happened (metadata).      | 60 / hour           |
| `/api/exports/<uuid>/`       | DELETE | Remove an audit row (the user's PDF is untouched). | 20 / min            |
| `/api/schema/`               | GET    | OpenAPI 3 schema (drf-spectacular).                | —                   |
| `/api/docs/`                 | GET    | Swagger UI rendered from the schema above.         | —                   |

All mutating endpoints require a valid Clerk JWT in the `Authorization: Bearer …` header. Ownership is enforced per-row — a user can only read or write trips and exports they own. A `—` in the throttle column means the endpoint does not set a `throttle_scope` and is therefore not rate-limited by the project's `PerUserScopedThrottle`.

## Apps

| App                                      | Path                                       | Owns                                                                                         |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `geocoding`                              | `web_api/apps/geocoding/`                  | ORS Pelias proxy (autocomplete + full search).                                               |
| `trips`                                  | `web_api/apps/trips/`                      | `Trip`, `TripRouteCache`, `TripStop`, `LogEvent`, `LogDay` models, plan pipeline, ownership. |
| `exports`                                | `web_api/apps/exports/`                    | `TripExport` metadata-only audit log (no PDF bytes).                                         |
| `hos` (pure Python, not a Django app)    | `web_api/hos/`                             | The HOS planner — given route legs + cycle hours used + start time, emits `list[LogEvent]`.  |
| `integrations.openrouteservice` (module) | `web_api/integrations/openrouteservice.py` | The single ORS client. Directions, geocoding, response caching keyed by trip inputs.         |

## Local development

Prereqs: Python 3.13, [`uv`](https://docs.astral.sh/uv/), Postgres 17.

```bash
cd apps/web-api
uv sync                       # installs locked deps into .venv/
uv run manage.py migrate      # apply migrations against $DATABASE_URL
uv run manage.py runserver    # serves on http://127.0.0.1:8000
```

## Environment variables

Validated at boot by `web_api/settings/base.py` via pydantic-settings. No `.env*` template is tracked — create your own `.env` next to `manage.py` and Django reads it on startup. Production secrets live in the Vercel project's Environment Variables panel.

| Variable                    | Type     | Purpose                                                                                                        |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `DEBUG`                     | bool     | Django debug mode. Always false in production.                                                                 |
| `DJANGO_SETTINGS_MODULE`    | string   | `web_api.settings.prod` in production. Default is `web_api.settings.dev` locally.                              |
| `SECRET_KEY`                | string   | Django session and signing key. Rotated per environment.                                                       |
| `ALLOWED_HOSTS`             | string[] | Hostnames Django will accept (JSON array).                                                                     |
| `DATABASE_URL`              | URL      | Postgres DSN read by psycopg 3. **In production use Neon's pooled URL** (hostname contains `-pooler`).         |
| `CORS_ALLOWED_ORIGINS`      | URL[]    | Origins allowed to call this API cross-origin (JSON array).                                                    |
| `CSRF_TRUSTED_ORIGINS`      | URL[]    | Scheme-qualified prod origins Django trusts for unsafe-method requests (JSON array; prod-only).                |
| `CLERK_PUBLISHABLE_KEY`     | string   | Clerk publishable key for the same instance the frontends use.                                                 |
| `CLERK_SECRET_KEY`          | string   | Clerk secret key. Server-side only — never reaches the browser.                                                |
| `CLERK_JWT_ISSUER`          | URL      | Clerk instance issuer URL. Used to fetch the JWKS for JWT verification.                                        |
| `OPENROUTESERVICE_API_KEY`  | secret   | HeiGIT ORS key. Free standard plan is 2 000 req/day, 40 req/min.                                               |
| `OPENROUTESERVICE_BASE_URL` | URL      | ORS base URL. Locked to the documented HeiGIT host by an SSRF-defense allowlist in `web_api/settings/base.py`. |

## Project layout

```
apps/web-api/
├── web_api/
│   ├── apps/
│   │   ├── geocoding/        # ORS Pelias proxy (autocomplete + search)
│   │   ├── trips/            # Trip CRUD + plan pipeline + route cache
│   │   └── exports/          # Metadata-only audit log
│   ├── auth/                 # ClerkAuthentication, /api/me/ view
│   ├── hos/                  # Pure-Python HOS planner (no Django imports)
│   ├── integrations/
│   │   └── openrouteservice.py  # The only ORS client
│   ├── settings/
│   │   └── base.py           # pydantic-settings schema
│   ├── exception_handler.py  # DRF error envelope
│   ├── pagination.py         # Capped LimitOffsetPagination
│   ├── throttling.py         # PerUserScopedThrottle (keyed by Clerk sub)
│   ├── asgi.py / wsgi.py
│   └── urls.py
├── tests/                    # pytest scenarios; HOS goldens cite FMCSA §395
├── pyproject.toml
└── uv.lock
```

## Commands

| Command                                            | What it runs                               |
| -------------------------------------------------- | ------------------------------------------ |
| `uv sync`                                          | Install locked dependencies into `.venv/`. |
| `uv run manage.py migrate`                         | Apply migrations against `DATABASE_URL`.   |
| `uv run manage.py runserver`                       | Start the dev server on port 8000.         |
| `uv run pytest`                                    | Run the full test suite.                   |
| `uv run ruff check`                                | Lint.                                      |
| `uv run ruff format --check`                       | Format check (CI form).                    |
| `uv run mypy`                                      | Strict-mode type check.                    |
| `uv run manage.py spectacular --file openapi.yaml` | Regenerate the OpenAPI 3 schema on disk.   |

## Testing

- pytest 9 + pytest-django + factory_boy for fixtures. Database access is opt-in per test via `@pytest.mark.django_db`.
- HOS goldens cite the specific FMCSA §395 paragraph they interpret — no test invents regulation.
- `tests/hos/test_boundary.py` AST-walks `web_api/hos/` and fails if any module reaches outside the stdlib + the planner's allowlist. This is what keeps the planner Django-free.

## Build & deploy

- **Hosting** — Vercel's Python runtime (Fluid Compute). Vercel auto-detects Django via `manage.py`, reads `WSGI_APPLICATION` from `settings.prod`, and bundles the WSGI app as a single function. Source: <https://vercel.com/docs/frameworks/full-stack/django>.
- **Database** — [Neon](https://neon.com) managed Postgres. The connection string in `DATABASE_URL` is the **pooled** endpoint (hostname contains `-pooler`), with the Neon-Django guide's recommended settings wired in `web_api/settings/prod.py` (`sslmode=require`, `CONN_MAX_AGE=240`, `CONN_HEALTH_CHECKS=True`, `DISABLE_SERVER_SIDE_CURSORS=True`).
- **Static files** — Vercel runs `collectstatic` automatically during build and serves the result from the Vercel CDN. WhiteNoise stays in `MIDDLEWARE` so `vercel dev` works locally; in production it's a no-op behind the CDN.
- **Migrations** — applied at build time via `[tool.vercel.scripts].build = "python manage.py migrate --noinput"` in `pyproject.toml`. A failing migration fails the deploy.
- **Health check** — `GET /api/healthz/` runs a `SELECT 1` and returns `{"status": "ok", "db": true}` (503 if the DB is unreachable). The cheap `GET /healthz` (no DB) is still wired at the root for basic ping use.
- CORS, CSRF, and the Clerk JWT issuer are configured per environment via Vercel project environment variables.

## Related

- [Root README](../../README.md)
- [`@outbound/web-app`](../web-app/README.md)
- [`@outbound/web-auth`](../web-auth/README.md)
- FMCSA HOS regulations the planner interprets — [`docs/interstate-truck-driver-guide.md`](../../docs/interstate-truck-driver-guide.md)
