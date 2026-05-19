# Outbound Spotter

Trip-planning web app for property-carrying interstate truck drivers. Inputs current location, pickup, dropoff, and cycle hours used; outputs a routed map (Leaflet + OpenRouteService `driving-hgv`) and a set of FMCSA §395.8-compliant Daily Log Sheets drawn as the driver would log them.

**Stack**: Turborepo monorepo (pnpm 11, Node 24 LTS) — `apps/web-app` (Vite 8 + React 19.2 + TS 6 + Tailwind v4 + shadcn/ui), `apps/web-auth` (Clerk Core 3 `@clerk/react` with custom shadcn-blocks screens), `apps/web-api` (Django 5.2 LTS + DRF 3.17 on Python 3.13 + uv, PostgreSQL 17).

- Product, scope, success criteria → [`context/project-overview.md`](context/project-overview.md)
- System boundaries, invariants, pinned versions → [`context/architecture.md`](context/architecture.md)
- Entry point for AI agents → [`CLAUDE.md`](CLAUDE.md)

Hosting plan: Vercel (`web-app`, `web-auth`) + Fly.io (`web-api` + Postgres), free tier.
