# @outbound/web-api

The Django + DRF service. Owns the HOS planner (pure Python under `web_api/hos/`), the ORS client, all DB writes, and Clerk JWT verification. Managed with `uv`.

## Local dev

```bash
uv sync
uv run manage.py migrate
uv run manage.py runserver
```

Default port: `8000`. Pair with `web-app` on `5173` and `web-auth` on `5174` for a full local stack.

## Environment variables

No `.env*` template is tracked in the repo (per `CONTRIBUTING.md` §6). Create a `.env` with the variables below — Django (via pydantic-settings) reads it on boot. The schema lives in `web_api/settings/base.py`.

| Variable                    | Purpose                                                                 | Example                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DEBUG`                     | Django debug mode. Never `true` in production.                          | `true` (dev) / `false` (prod)                                                                                 |
| `SECRET_KEY`                | Django session signing key. Rotate per environment.                     | (generate with `python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"`) |
| `ALLOWED_HOSTS`             | JSON array of hostnames Django will accept.                             | `["localhost","127.0.0.1"]`                                                                                   |
| `DATABASE_URL`              | Postgres DSN; psycopg 3 reads it.                                       | `postgresql://outbound:outbound@localhost:5432/outbound_dev`                                                  |
| `CORS_ALLOWED_ORIGINS`      | JSON array of origins the API will accept cross-origin requests from.   | `["http://localhost:5173","http://localhost:5174"]`                                                           |
| `CLERK_PUBLISHABLE_KEY`     | Clerk publishable key for the same instance the frontend uses.          | `pk_test_…`                                                                                                   |
| `CLERK_SECRET_KEY`          | Clerk secret key. Server-side only — never reaches the browser.         | `sk_test_…`                                                                                                   |
| `CLERK_JWT_ISSUER`          | Clerk instance issuer URL. Used to fetch the JWKS for JWT verification. | `https://<instance>.clerk.accounts.dev`                                                                       |
| `OPENROUTESERVICE_API_KEY`  | HeiGIT ORS standard-plan key. Free tier: 2000 req/day, 40 req/min.      | (rotate per env)                                                                                              |
| `OPENROUTESERVICE_BASE_URL` | ORS base URL. Override only when self-hosting the engine.               | `https://api.openrouteservice.org`                                                                            |

Production values live in Fly.io secrets:

```bash
fly secrets set CLERK_SECRET_KEY=sk_live_… DATABASE_URL=… …
```

## Layout

- `web_api/` — Django project (settings, ASGI entrypoint).
- `web_api/apps/` — feature apps (`trips`, `users`, `logs`, …) once the v1 surface lands.
- `web_api/hos/` — pure-Python HOS planner. **No Django imports** (architecture invariant #1).
- `web_api/integrations/openrouteservice.py` — the only place ORS is called.
- `tests/` — pytest scenarios; HOS goldens cite the FMCSA paragraph they interpret.

## Sources of truth

- `context/architecture.md` — invariants (auth/ownership, HOS module boundary, no client-side HOS math).
- `context/code-standards.md` — Python 3.13, mypy --strict, Ruff, DRF conventions.
- `docs/interstate-truck-driver-guide.md` — FMCSA HOS regulation source for the planner.
