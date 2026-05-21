# @outbound/web-auth

<p align="center">
  <a href="../../LICENSE.md"><img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-008080?style=flat" /></a>
  <img alt="Stack" src="https://img.shields.io/badge/stack-Vite%208%20%C2%B7%20Clerk%20Core%203-6c47ff?style=flat" />
  <img alt="Port" src="https://img.shields.io/badge/port-5174-3D9296?style=flat" />
</p>

The Clerk-backed auth UI. Lives on a sister origin so the auth surface can re-theme freely without touching the trip-planner shell.

## Overview

- **What it is.** A small SPA that hosts every authentication screen — sign-in, sign-up, forgot-password, and the OAuth return.
- **Why it's separate.** Splitting auth out of the trip-planner means we can iterate on visual polish here without re-deploying `web-app`, and the planner never has to render unauthenticated chrome.
- **What it does NOT own.** No trip planning, no map, no log sheets — those all live in `@outbound/web-app`.

## Routes

| Path               | Component                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `/`                | Redirects to `/sign-in` (or to `web-app` if the user is already signed in).              |
| `/sign-in`         | Email + password, Google OAuth, and a forgot-password link.                              |
| `/sign-up`         | Email + password sign-up with inline `email_code` verification, Turnstile, and zxcvbn-3. |
| `/forgot-password` | Three-phase reset (email → verification code → new password).                            |
| `/sso-callback`    | Returns from Google OAuth and hands control back to Clerk's `<HandleOAuthCallback />`.   |
| `*`                | Anything else falls back to `/sign-in`.                                                  |

## Auth flows

- **Sign-in.** Email + password, plus Google OAuth via Clerk's hosted flow.
- **Sign-up.** Email + password with inline `email_code` verification (no email link), Turnstile bot protection on submit, and a zxcvbn-3 password-strength gate.
- **Forgot password.** Three phases — request the code by email, enter the code, set a new password — all on a single route with explicit state transitions.

## Local development

Prereqs: Node 24 LTS, pnpm 11, and a Clerk instance (the publishable key is per-environment; pull yours from the Clerk dashboard).

```bash
pnpm install                           # at repo root
pnpm --filter @outbound/web-auth dev   # serves on http://localhost:5174
```

Pair with `@outbound/web-app` on `:5173` so post-auth redirects land somewhere.

## Environment variables

Validated at runtime by `src/config/env.ts` (zod). No `.env*` template is tracked — create `.env.local` with your own values and Vite picks it up.

| Variable                     | Read by                   | Type   | Purpose                                                   |
| ---------------------------- | ------------------------- | ------ | --------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `src/app/provider.tsx`    | string | Per-environment Clerk publishable key (never the secret). |
| `VITE_APP_URL`               | `src/features/auth/api/*` | URL    | Post-auth redirect target (the `web-app` origin).         |
| `VITE_SUPPORT_EMAIL`         | `src/features/auth/*`     | email  | Surfaced in error UIs as a "need help?" mailto.           |

Production values live in the Vercel project's Environment Variables panel.

## Project layout

```
src/
├── app/        # provider.tsx, router.tsx, routes/
├── assets/     # brand SVGs, fonts (loaded via index.html)
├── components/ # shared cross-feature composites (incl. ui/ from shadcn CLI)
├── config/     # env.ts (zod-validated)
├── features/
│   └── auth/   # sign-in / sign-up / forgot-password / sso-callback
├── lib/        # api-client, utils re-export
├── styles/     # globals.css (imports @outbound/ui/styles/globals.css)
└── testing/    # Vitest setup, MSW handlers, render helpers
```

Today `auth/` is the only feature folder; the layout still mirrors `web-app` so a second feature could slot in without restructuring.

## Scripts

| Script          | What it runs                                             |
| --------------- | -------------------------------------------------------- |
| `dev`           | Vite dev server.                                         |
| `build`         | `tsc -b --noEmit` then `vite build`.                     |
| `preview`       | Serves `dist/` for smoke testing.                        |
| `lint`          | ESLint flat config from `@outbound/eslint-config/react`. |
| `lint:fix`      | Same as `lint`, applies safe autofixes.                  |
| `typecheck`     | `tsc -b --noEmit`.                                       |
| `test`          | Vitest with jsdom.                                       |
| `test:watch`    | Vitest in watch mode.                                    |
| `test:coverage` | Vitest with v8 coverage.                                 |

## Testing

- Vitest 4 + jsdom + React Testing Library 16, MSW handlers under `src/testing/` mock Clerk responses.
- Co-located `*.test.tsx` files next to the unit.
- Playwright smokes are run on the workstation during pre-merge review (not part of CI).

## Build & deploy

- `vite build` outputs to `dist/`. Static deploy — no server needed.
- Hosted on Vercel. Environment variables are set in the Vercel project's Environment Variables panel.

## Related

- [Root README](../../README.md)
- [`@outbound/web-app`](../web-app/README.md)
- [`@outbound/web-api`](../web-api/README.md)
- [`@outbound/ui`](../../packages/ui/README.md)
- Clerk Core 3 docs — <https://clerk.com/docs>
