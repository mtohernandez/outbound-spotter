# @outbound/web-auth

The Clerk-backed auth UI. Vite + React 19 + TS 6 + Tailwind v4. Custom `<SignIn />` / `<SignUp />` screens themed via the shared `@outbound/ui` tokens. No trip-planning logic — that's `web-app`.

## Local dev

```bash
pnpm --filter @outbound/web-auth dev
```

Default port: `5174`. Pair with `web-app` on `5173`.

## Routes

| Path                | Component                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `/sign-in`          | Custom sign-in flow (email + password, Google OAuth, forgot-password link).                 |
| `/sign-up`          | Custom sign-up flow with inline email-code verification, Turnstile, zxcvbn-3 strength gate. |
| `/forgot-password`  | Three-phase reset (email → code → new password).                                            |
| `/sso-callback`     | Returns from Google OAuth and hands control to `<HandleOAuthCallback />`.                   |
| `*` (anything else) | Redirects to `/sign-in`.                                                                    |

## Environment variables

No `.env*` template is tracked in the repo (per `CONTRIBUTING.md` §6). Create a `.env.local` with the variables below and Vite will pick it up. The schema is enforced at runtime by `src/config/env.ts` (zod).

| Variable                     | Read by                   | Example                       | Notes                                               |
| ---------------------------- | ------------------------- | ----------------------------- | --------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `src/app/provider.tsx`    | `pk_test_…`                   | Per-environment publishable key — never the secret. |
| `VITE_APP_URL`               | `src/features/auth/api/*` | `http://localhost:5173`       | Post-auth redirect target (the `web-app` origin).   |
| `VITE_SUPPORT_EMAIL`         | `src/features/auth/...`   | `support@outboundspotter.com` | Surfaced in error UIs ("Need help?").               |

Production values live in the Vercel project's Environment Variables panel.

## Sources of truth

- `context/architecture.md` — auth model (Clerk JWKS, `@clerk/react` Core 3, `<Show>` primitives).
- `context/ui-context.md` — auth-screen layout pattern (single-column centered, max-w 384px).
- `@outbound/ui` — primitives and theme.
- <https://clerk.com/docs/react/getting-started/quickstart> — upstream Clerk Core 3 guide.
