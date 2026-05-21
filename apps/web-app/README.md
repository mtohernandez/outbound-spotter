# @outbound/web-app

<p align="center">
  <a href="../../LICENSE.md"><img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-008080?style=flat" /></a>
  <img alt="Stack" src="https://img.shields.io/badge/stack-Vite%208%20%C2%B7%20React%2019-61dafb?style=flat&logo=react&logoColor=black" />
  <img alt="Port" src="https://img.shields.io/badge/port-5173-3D9296?style=flat" />
</p>

The trip-planner SPA — the UI a driver actually uses. Pulls the shared theme and primitives from `@outbound/ui`.

## Overview

- **What it is.** A single-page React app for entering trip inputs (current, pickup, dropoff, cycle hours used) and reviewing the resulting route + daily log sheets.
- **What it does.** Renders the address form, the Leaflet map, the §395.8 log sheets, the client-side PDF export, and the per-user trip + export history.
- **What it does NOT own.** Hours-of-service math, OpenRouteService calls, and server-side PDF rendering all live in `@outbound/web-api`. This app renders what the API returns.

## Routes

| Path         | Purpose                                                   | Auth     |
| ------------ | --------------------------------------------------------- | -------- |
| `/`          | Redirects to `/trips`.                                    | required |
| `/trips`     | Saved trips list, sorted newest first.                    | required |
| `/trips/new` | Trip-input form (current, pickup, dropoff, cycle hours).  | required |
| `/trips/:id` | Trip workspace — map, route summary, daily log sheets.    | required |
| `/exports`   | Audit history of every PDF export the user has triggered. | required |

Unauthenticated visitors are redirected to the auth origin (`@outbound/web-auth`).

## Features

Each lives under `src/features/<name>/` per the [Bulletproof React](https://github.com/alan2207/bulletproof-react) layout.

- **`trip-planner`** — Address form, geocoded autocomplete, map view, route polyline + stop markers.
- **`saved-trips`** — Per-user trip list, delete, open.
- **`log-sheet`** — §395.8 24-hour grid renderer with totals + Remarks.
- **`pdf-export`** — Composes per-day log SVGs into a single PDF in the browser.
- **`exports`** — Read-only history of past exports (audit metadata only — no PDF blobs server-side).

## Local development

Prereqs: Node 24 LTS, pnpm 11. Pair with `@outbound/web-api` on `:8000` and `@outbound/web-auth` on `:5174` for a full local stack.

```bash
pnpm install                          # at repo root
pnpm --filter @outbound/web-app dev   # serves on http://localhost:5173
```

## Environment variables

Validated at runtime by `src/config/env.ts` (zod). No `.env*` template is tracked — create `.env.local` with your own values and Vite picks it up.

| Variable                     | Read by                | Type   | Purpose                                                    |
| ---------------------------- | ---------------------- | ------ | ---------------------------------------------------------- |
| `VITE_API_URL`               | `src/config/env.ts`    | URL    | Base URL for the Django `web-api` service.                 |
| `VITE_CLERK_PUBLISHABLE_KEY` | `src/app/provider.tsx` | string | Per-environment Clerk publishable key (never the secret).  |
| `VITE_AUTH_SIGN_IN_URL`      | `src/app/provider.tsx` | URL    | Where `<ClerkProvider>` sends signed-out users to sign in. |
| `VITE_AUTH_SIGN_UP_URL`      | `src/app/provider.tsx` | URL    | Where `<ClerkProvider>` sends signed-out users to sign up. |

Production values live in the Vercel project's Environment Variables panel.

## Project layout

```
src/
├── app/        # provider.tsx, router.tsx, routes/
├── assets/     # brand SVGs, fonts (loaded via index.html)
├── components/ # shared cross-feature composites (incl. ui/ from shadcn CLI)
├── config/     # env.ts (zod-validated), paths.ts
├── features/   # per-feature folders (api/components/hooks/stores/types/utils)
├── hooks/      # shared cross-feature hooks
├── lib/        # api-client, query-client, utils re-export
├── stores/     # global stores (rare)
├── styles/     # globals.css (imports @outbound/ui/styles/globals.css)
├── testing/    # Vitest setup, MSW handlers, render helpers
├── types/      # cross-feature TS types
└── utils/      # cross-feature pure utilities
```

Import direction (shared → features → app) is enforced by the Bulletproof zones in `@outbound/eslint-config/react`.

## Scripts

| Script          | What it runs                                             |
| --------------- | -------------------------------------------------------- |
| `dev`           | Vite dev server.                                         |
| `build`         | `tsc -b --noEmit` then `vite build`.                     |
| `preview`       | Serves `dist/` for smoke testing.                        |
| `lint`          | ESLint flat config from `@outbound/eslint-config/react`. |
| `lint:fix`      | Same as `lint`, applies safe autofixes.                  |
| `typecheck`     | `tsc -b --noEmit` across app + node projects.            |
| `test`          | Vitest with jsdom.                                       |
| `test:watch`    | Vitest in watch mode.                                    |
| `test:coverage` | Vitest with v8 coverage.                                 |

The canonical CI form is `pnpm exec turbo run <task> --filter=@outbound/web-app` (or `--affected` for the changed-files sweep).

## Testing

- Vitest 4 + jsdom + React Testing Library 16, MSW handlers under `src/testing/`.
- Co-located `*.test.tsx` files next to the unit they cover (Bulletproof convention).
- Query order: `getByRole` → `getByLabelText` → `getByText` → `getByTestId` (last resort).

## Build & deploy

- `vite build` outputs to `dist/`. Static deploy — no server needed.
- Hosted on Vercel. Environment variables are set in the Vercel project's Environment Variables panel.

## Related

- [Root README](../../README.md)
- [`@outbound/web-auth`](../web-auth/README.md)
- [`@outbound/web-api`](../web-api/README.md)
- [`@outbound/ui`](../../packages/ui/README.md)
