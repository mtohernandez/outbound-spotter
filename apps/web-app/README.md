# @outbound/web-app

The trip-planner SPA. Vite + React 19 + TS 6 + Tailwind v4. Pulls the shared theme + primitives from `@outbound/ui`. No features yet — this is the shell.

## Local dev

```bash
cp .env.local.example .env.local
pnpm --filter @outbound/web-app dev
```

Default port: `5173`. Pair with `web-auth` on `5174` and `web-api` on `8000` for a full local stack.

## Layout

Follows [Bulletproof React](https://github.com/alan2207/bulletproof-react) exactly:

```
src/
├── app/        # provider.tsx, router.tsx, routes/
├── assets/     # brand SVGs, fonts (loaded via index.html)
├── components/ # shared cross-feature composites (placeholder)
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

Import direction is enforced via the Bulletproof zones in `@outbound/eslint-config/react`.

## Scripts

| Script          | What it runs                                            |
| --------------- | ------------------------------------------------------- |
| `dev`           | Vite dev server                                         |
| `build`         | `tsc -b --noEmit` then `vite build`                     |
| `preview`       | Serve `dist/` for smoke testing                         |
| `lint`          | ESLint flat config from `@outbound/eslint-config/react` |
| `typecheck`     | `tsc -b --noEmit` (app + node projects)                 |
| `test`          | Vitest with jsdom                                       |
| `test:coverage` | Vitest with v8 coverage                                 |

Run via Turbo: `pnpm exec turbo run dev --filter=@outbound/web-app`.

## Sources of truth

- `context/architecture.md` — invariants (no client-side HOS math, no raw ORS calls, no client-side PDF rendering yet).
- `context/code-standards.md` — TS, React 19, Bulletproof, naming, testing.
- `context/ui-context.md` — colors, density, motion, shadcn rules.
- `@outbound/ui` — single source of truth for primitives and theme.
