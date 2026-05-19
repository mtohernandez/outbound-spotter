# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Foundation + auth scaffolding (spec 01 implementation complete; spec 02 queued).

## Current Goal

- Land the two auth-foundation specs end-to-end so the project ships a brand-themed sign-in / sign-up / forgot-password experience on `auth.<host>` with Clerk Core 3, OAuth (Google + Apple), bot protection, and WCAG 2.2 AA accessibility.

## Completed

- 2026-05-19 — `context/specs/01-shared-ui-foundation.md` authored (`packages/ui` shadcn primitives + `BrandMark` + `SpotterLoader` + `ThemeProvider` / `useTheme` / `ThemeToggle` + Vitest harness).
- 2026-05-19 — `context/specs/02-clerk-auth-screens.md` authored (`apps/web-auth` custom Clerk flows with floating video panel, OAuth, inline email-code verification, bot protection, forgot-password, theme toggle, accessibility floor).
- 2026-05-19 — `feat/01-shared-ui-foundation` implemented (10 shadcn primitives, inline-JSX `BrandMark` + animated `SpotterLoader`, `ThemeProvider` / `useTheme` / `ThemeToggle` colocated under `components/theme/`, Vitest 4 + RTL 16 harness with 21 colocated tests, exports override for the .ts hook, sonner wired to the new theme primitive).

## In Progress

- None.

## Next Up

1. `feat/02-clerk-auth-screens` — implement spec 02 on top of merged spec 01. Verification gate: the full browser-test matrix in §02#Browser-test matrix + sub-agent reviews (`code-reviewer`, `architect-review`, `security-auditor`, `ui-visual-validator`, `performance-optimizer`) + the Clerk-dashboard checklist.

## Open Questions

- **`@clerk/testing` v6 support.** Verify the package supports `@clerk/react` v6 React mocking at the time spec 02 implementation begins (<https://clerk.com/docs/guides/development/testing/overview>). If the v6 helpers aren't shipped, fall back to hand-rolled `vi.mock("@clerk/react", …)` shims and document the fallback in the PR body.

## Architecture Decisions

- 2026-05-19 — **Two-spec split for the auth experience.** Reason: `context/ai-workflow-rules.md`'s "one system boundary per unit" rule. Spec 01 lands shared primitives in `packages/ui` (the UI source of truth per `CLAUDE.md`); spec 02 builds the three custom Clerk flows on top inside `apps/web-auth`. Rejected: a single combined spec — would have mixed two boundaries and required two verification paths.
- 2026-05-19 — **Mirror the auth background video with responsive `<source>` tags + poster.** Reason: removes a third-party CDN dependency and gives us a predictable LCP via the poster image (per <https://web.dev/articles/lcp>). Combined desktop + mobile + poster ≤ ~5 MB; encoded with `ffmpeg -movflags +faststart` so streaming starts immediately.
- 2026-05-19 — **Inline email-code verification on `/sign-up`.** Reason: matches Clerk's `email_code` example, avoids a route-change/redirect cycle, and lets focus management move directly to the OTP cell without losing in-progress form state.
- 2026-05-19 — **MFA (TOTP / SMS / backup codes) is out of v1 scope.** Reason: matches `project-overview.md`'s v1 in-scope list (single driver, no admin role). "High-end security" still holds via Clerk Turnstile bot protection, zxcvbn-ts strength gating, and the HaveIBeenPwned (`form_password_pwned`) compromised-password check. Revisit after launch.
- 2026-05-19 — **Clerk instance configuration is owned by the session via the `clerk` CLI, not by the user.** Reason: env vars already hold real instance keys, so the implementer can drive SSO connections, bot protection, password rules, and redirect-URL allowlists directly through the Clerk Backend / Platform API. Eliminates the manual-dashboard handoff and lets the PR body capture the exact instance state via CLI output.
- 2026-05-19 — **End-to-end testing is performed by the session-attached Playwright MCP, not by committed Playwright source.** Reason: E2E coverage must drive a real browser as a real user, but the project does not need (and `architecture.md` does not pin) `@playwright/test` as a repo dependency. The MCP is the runner; artifacts (screenshots, DOM snapshots, trace) are attached to the PR body per scenario.
- 2026-05-19 — **`aria-pressed` (not `role="switch"`) for the show/hide password toggle and the theme toggle.** Reason: the W3C APG button-toggle pattern (<https://www.w3.org/WAI/ARIA/apg/patterns/button/>) prefers `aria-pressed` for two-state buttons without a track/thumb metaphor; the toggle label stays constant so screen readers don't thrash.
- 2026-05-19 — **`<Show when="signed-in">` / `<Show when="signed-out">` as the gating primitive across both apps.** Reason: Clerk Core 3 deprecates `<SignedIn>` / `<SignedOut>` in favor of `<Show>` (<https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3>). The architecture file already records this; no implementation has had to pick yet, so the decision lands here.
- 2026-05-19 — **Brand SVGs inlined as JSX inside `BrandMark` and `SpotterLoader`** (spec 01 deviation). Reason: `packages/ui` is a JIT source-consumption package with no bundler (no Vite, tsup, or tsc emit), so the spec's SVGR pipeline is contingent on infrastructure that does not exist. Inline JSX keeps the `packages/ui-only` boundary, lets the loader animation target each circle directly via CSS keyframes scoped by `useId`, and passes the hex-free rule by mapping brand colors to OKLCH ramp CSS variables (`var(--teal-*)`, `var(--red-500)`). `src/assets/brand/` is not created.
- 2026-05-19 — **`packages/ui/package.json#exports` gains one specific key for `./components/theme/use-theme`** (spec 01 deviation). Reason: the spec colocates the `useTheme` hook with the provider, but the existing pattern `./components/*` → `./src/components/*.tsx` only resolves `.tsx`. Node and TypeScript both honor specific keys over pattern keys, so a single targeted override preserves the public API verbatim while keeping the pattern intact for every other component.
- 2026-05-19 — **shadcn `toggle` primitive dropped from the install list** (spec 01 deviation). Reason: the spec's own Step 3 implements `ThemeToggle` as `Button variant="ghost" size="icon"` with `aria-pressed` per the recorded APG decision, so `toggle` would have shipped with no callsite. `code-standards.md` forbids installs without a callsite ("Untouched dependencies are noise").
- 2026-05-19 — **`sonner.tsx` hand-edited to import `useTheme` from our theme primitive** (spec 01 deviation). Reason: shadcn 4's canonical sonner wrapper imports `useTheme` from `next-themes`, which (a) duplicates a theme controller alongside our `ThemeProvider` and (b) yields `theme: string | undefined`, breaking the typecheck under `exactOptionalPropertyTypes`. The minimal 3-line edit replaces the import path and removes the now-obsolete `as ToasterProps["theme"]` cast. The `next-themes` dep is dropped. If we re-run `shadcn add sonner --overwrite` later, this edit must be re-applied.
- 2026-05-19 — **`packages/ui/eslint.config.js` adds an override for `src/components/ui/**`** turning off `import-x/order`, `react-refresh/only-export-components`, `@typescript-eslint/consistent-type-definitions`, `@typescript-eslint/no-unnecessary-condition`, `@typescript-eslint/no-unnecessary-template-expression`, `@typescript-eslint/no-unnecessary-type-conversion`. Reason: those rules fight canonical shadcn output. Per `code-standards.md`, the files under `components/ui/\*` are CLI-owned and re-run-to-update — we adapt the linter rather than patch the generated code.
- 2026-05-19 — **Vitest setup ships an in-memory `Storage` shim and a `matchMedia` stub.** Reason: under vitest 4.1.6 + jsdom 29.1.1 in this pool configuration, `window.localStorage` exists but its prototype methods (`setItem`, `clear`) are not callable, and `window.matchMedia` is not defined. A 30-line shim in `packages/ui/src/test/setup.ts` restores the contract the `ThemeProvider` relies on; production code is unaffected.

## Session Notes

- The repo is fully scaffolded as of this session: `apps/web-app`, `apps/web-auth`, `apps/web-api`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config` all present with locked versions (`@clerk/react` 6.6.6, React 19.2.6, Tailwind 4.3.0, Vite 8.0.13, TS 6.0.3, Django 5.2, `clerk-backend-api` 5.0.6).
- `packages/ui/src/styles/globals.css` already ships the OKLCH teal + red ramps, the `@theme inline` block, and the Geologica / DM Sans / JetBrains Mono fallbacks per `context/ui-context.md`. Spec 01 deliberately does not edit it.
- `apps/web-auth/src/app/routes/{sign-in,sign-up,sso-callback}.tsx` currently render Clerk's prebuilt `<SignIn>` / `<SignUp>` / `<AuthenticateWithRedirectCallback>` widgets. Spec 02 replaces them with custom flows; `sso-callback.tsx` keeps the `AuthenticateWithRedirectCallback` usage.
- `apps/web-app` and its `<ClerkProvider>` (with `signInUrl` / `signUpUrl` → `VITE_AUTH_*`) are untouched in both specs.
- Husky hooks (`pre-commit` lint-staged, `pre-push` typecheck + test + push protection on `main` / `develop`, `commit-msg` commitlint) and the single CI workflow (`.github/workflows/ci.yml`) are confirmed wired and used by the verification gates in each spec.
- Resume cue for the next session: open `context/specs/01-shared-ui-foundation.md`, create branch `feat/01-shared-ui-foundation` off `develop`, walk Step 1 → Step 4 of the spec's Sequencing section.
