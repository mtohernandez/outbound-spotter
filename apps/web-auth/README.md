# @outbound/web-auth

The Clerk-backed auth UI. Vite + React 19 + TS 6 + Tailwind v4. Custom `<SignIn />` / `<SignUp />` screens themed via the shared `@outbound/ui` tokens. No trip-planning logic — that's `web-app`.

## Local dev

```bash
cp .env.local.example .env.local
pnpm --filter @outbound/web-auth dev
```

Default port: `5174`. Pair with `web-app` on `5173`.

## Routes

| Path            | Component                                                  |
| --------------- | ---------------------------------------------------------- |
| `/sign-in/*`    | `<SignIn />` (Clerk catch-all, path-based routing)         |
| `/sign-up/*`    | `<SignUp />`                                               |
| `/sso-callback` | `<AuthenticateWithRedirectCallback />` for OAuth providers |
| `*` (anything)  | Redirects to `/sign-in`                                    |

## Sources of truth

- `context/architecture.md` — auth model (Clerk JWKS, `@clerk/react` Core 3, `<Show>` primitives).
- `context/ui-context.md` — auth-screen layout pattern (single-column centered, max-w 384px).
- `@outbound/ui` — primitives and theme.
- <https://clerk.com/docs/react/getting-started/quickstart> — upstream Clerk Core 3 guide.
