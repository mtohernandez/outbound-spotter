# @outbound/web-apex

<p align="center">
  <a href="../../LICENSE.md"><img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-008080?style=flat" /></a>
  <img alt="Stack" src="https://img.shields.io/badge/stack-Vite%208%20%C2%B7%20Clerk%20satellite-6c47ff?style=flat" />
  <img alt="Port" src="https://img.shields.io/badge/port-5175-3D9296?style=flat" />
</p>

The apex redirector. A signed-out visitor lands on `<host>` and gets sent to `accounts.<host>/sign-in`; a signed-in visitor gets sent to `app.<host>`. The entire app is one route, one component, one decision.

## Why a third app

`@outbound/web-app` (trip planner) and `@outbound/web-auth` (sign-in / sign-up) each own a tenant subdomain. The apex (`outbound-spotter.vercel.app`) needs a tiny surface that:

1. Asks Clerk "is the visitor signed in?" via the satellite-domain handshake.
2. Replaces the URL with the correct tenant.

Putting that logic in either tenant would mix concerns — apex stays its own deployment so the routing brain stays unambiguous.

## Routes

A single component (`<Redirector />`) renders the `<SpotterLoader />` while `useAuth()` is loading, then calls `window.location.replace(...)` once `isLoaded`. There is no router — the page exists only long enough to redirect.

## Local development

Prereqs: Node 24 LTS, pnpm 11, and a Clerk dev-instance publishable key.

```bash
pnpm install                           # at repo root
pnpm --filter @outbound/web-apex dev   # serves on http://localhost:5175
```

Pair with `@outbound/web-app` on `:5173` and `@outbound/web-auth` on `:5174` so the redirect targets exist.

## Environment variables

Validated at runtime by `src/config/env.ts` (zod). Production values live in the Vercel project's Environment Variables panel.

| Variable                     | Read by                                           | Type   | Purpose                                                           |
| ---------------------------- | ------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `src/app/provider.tsx`                            | string | Per-environment Clerk publishable key (never the secret).         |
| `VITE_APEX_URL`              | `src/app/provider.tsx`                            | URL    | Own deployed origin. Required by Clerk's satellite `domain` prop. |
| `VITE_APP_URL`               | `src/features/redirect/components/redirector.tsx` | URL    | Target for signed-in visitors.                                    |
| `VITE_AUTH_SIGN_IN_URL`      | `src/features/redirect/components/redirector.tsx` | URL    | Target for signed-out visitors.                                   |

## Project layout

```
src/
├── app/        # provider.tsx, app.tsx (no router — single component)
├── config/     # env.ts (zod-validated)
├── features/
│   └── redirect/components/redirector.tsx
└── styles/     # globals.css (imports @outbound/ui/styles/globals.css)
```

## Scripts

| Script      | What it runs                                             |
| ----------- | -------------------------------------------------------- |
| `dev`       | Vite dev server on port 5175.                            |
| `build`     | `tsc -b --noEmit` then `vite build`.                     |
| `preview`   | Serves `dist/` for smoke testing.                        |
| `lint`      | ESLint flat config from `@outbound/eslint-config/react`. |
| `lint:fix`  | Same as `lint`, applies safe autofixes.                  |
| `typecheck` | `tsc -b --noEmit`.                                       |
| `test`      | Vitest with `--passWithNoTests` (this app has no tests). |

## Build & deploy

- `vite build` outputs to `dist/`. Static deploy — no server needed.
- Hosted on Vercel as the apex domain project.
- Clerk satellite domain configuration: this origin is registered as a satellite of the `@outbound/web-auth` origin in the Clerk dashboard, so the handshake works without a paid plan in Clerk dev mode.

## Related

- [Root README](../../README.md)
- [`@outbound/web-app`](../web-app/README.md)
- [`@outbound/web-auth`](../web-auth/README.md)
- Clerk satellite domains — <https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains>
