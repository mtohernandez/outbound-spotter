# 02 — Clerk Auth Screens (sign-in, sign-up, forgot-password)

> Replace the prebuilt Clerk widgets in `apps/web-auth/src/app/routes/{sign-in,sign-up,sso-callback}.tsx` with brand-themed custom flows backed by `useSignIn` / `useSignUp` / `signIn.resetPasswordEmailCode`. Adds OAuth (Google + Apple), bot protection, inline email-code verification, password-strength validation, a floating video card on the left, accessible dark/light toggle, and the `/forgot-password` route. Builds entirely on top of `01-shared-ui-foundation.md`.

## Goal

Make the auth experience match the brand and the visual contract in `context/ui-context.md`, and clear the project's "high-end security" bar via Clerk's native abuse-protection primitives (Turnstile CAPTCHA + breached-password detection + server-enforced password rules) without inventing custom security code. The screens must reach WCAG 2.2 AA, pass keyboard-only traversal, and survive a screen-reader walk-through.

## Scope

### In

- `/sign-in` — email + password, Google OAuth, Apple OAuth, "Forgot password?" link, "Create account" link.
- `/sign-up` — email + password (with `zxcvbn-ts` strength meter), Google OAuth, Apple OAuth; inline email-code verification step on the same route after submit. Clerk Turnstile CAPTCHA mount.
- `/forgot-password` — 4-step inline state machine: email → code → new password → success/redirect.
- `/sso-callback` — kept as-is (already uses `AuthenticateWithRedirectCallback`).
- `/` — new index route that `Navigate replace`s to `/sign-in`.
- Layout: floating video card on the left, scrollable form column on the right, dead-link footer below. `BrandMark` + `ThemeToggle` pinned to the top of the right column.
- Two responsive video sources (`<source media>` switch) + poster image + `prefers-reduced-motion` handling.
- Vitest + RTL component tests, MSW handlers that mock Clerk's frontend API, and a browser smoke-test matrix.

### Out (deferred)

- MFA (TOTP, backup codes, SMS) — out of v1 scope per the planning decision.
- Username-based identifiers — email-only per `project-overview.md`.
- Magic-link sign-in — Clerk supports `email_link` but `email_code` is the chosen UX (planning decision).
- Account management UI / user profile screens.
- i18n (English only per `project-overview.md`).
- Anything inside `apps/web-app` (its `<ClerkProvider>` config and `VITE_AUTH_*` env vars already point at the right places).

## Prerequisites

- **Spec 01 is merged.** `packages/ui` exports the shadcn primitives, `BrandMark`, `SpotterLoader`, `ThemeProvider`, `useTheme`, and `ThemeToggle`.
- **Clerk env vars are already populated with real instance keys.** `VITE_CLERK_PUBLISHABLE_KEY` is set in `apps/web-auth/.env.local` and `apps/web-app/.env.local`; `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` + `CLERK_JWT_ISSUER` are set in the `web-api` settings. No manual dashboard setup is required of the user — the implementer applies every Clerk instance setting in-session via the `clerk` skill / CLI in Step 11.

## Boundary

Touches `apps/web-auth/` only:

- Routes under `apps/web-auth/src/app/routes/`.
- New Bulletproof feature folder `apps/web-auth/src/features/auth/`.
- Provider tweak in `apps/web-auth/src/app/provider.tsx` (wraps with `ThemeProvider`).
- Env vars in `apps/web-auth/src/config/env.ts` + new `apps/web-auth/.env.local.example`.
- Public assets under `apps/web-auth/public/auth/` (mirrored video + poster).
- Tests under `apps/web-auth/src/`.

`apps/web-api/` is not touched in this unit (Clerk JWT verification middleware lands in a later spec when the first protected endpoint ships).

## Sequencing

### Step 1 — Dependencies

Add (pinned via `npm view` at install time; record the resolved version in the PR body):

```bash
pnpm add --filter web-auth react-hook-form @hookform/resolvers zxcvbn-ts @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
pnpm add --filter web-auth -D msw @clerk/testing
```

Notes:

- `react-hook-form` and `@hookform/resolvers` are the project's form layer per `context/code-standards.md`. `zod` is already in `apps/web-auth/package.json` so the resolver works out of the box.
- `zxcvbn-ts` is the actively maintained TS fork of zxcvbn (which Clerk also uses server-side). The `@zxcvbn-ts/language-*` packages supply the dictionary.
- `@clerk/testing` provides test utilities for Clerk v6. If the installed version lacks v6 React support at install time (verify against <https://clerk.com/docs/guides/development/testing/overview>), fall back to hand-rolled `vi.mock("@clerk/react", …)` shims and document the decision in the PR.
- `msw` is already declared as `allowBuilds` in `pnpm-workspace.yaml`; pinning version 2.x via npm view.

### Step 2 — Env + paths

1. Update `apps/web-auth/src/config/env.ts` zod schema:
   - Keep `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_APP_URL`.
   - Add `VITE_SUPPORT_EMAIL` (`z.string().email().default("support@outboundspotter.com")`) — surfaced in error states for "Need help?" link.
2. Create `apps/web-auth/.env.local.example` documenting every variable (no secrets; only the keys + safe defaults).
3. Update `apps/web-auth/src/config/paths.ts`:
   - Keep `signIn: "/sign-in/*"`, `signUp: "/sign-up/*"`, `ssoCallback: "/sso-callback"`.
   - Add `forgotPassword: "/forgot-password"` and `root: "/"`.

### Step 3 — Mirror the video assets

The source video is at <https://blobby.wsimg.com/getty/videos/2208158101>. Download once, then re-encode locally:

```bash
mkdir -p apps/web-auth/public/auth
curl -L "https://blobby.wsimg.com/getty/videos/2208158101" -o /tmp/auth-source.mp4

# Desktop encode: 1280w, h264 baseline, ~2.5 Mbps, no audio, fast-start moov atom
ffmpeg -i /tmp/auth-source.mp4 \
  -an -vf "scale=1280:-2" -c:v libx264 -profile:v baseline -level 3.1 \
  -preset slow -crf 24 -movflags +faststart \
  apps/web-auth/public/auth/video-desktop.mp4

# Mobile encode: 720w
ffmpeg -i /tmp/auth-source.mp4 \
  -an -vf "scale=720:-2" -c:v libx264 -profile:v baseline -level 3.1 \
  -preset slow -crf 26 -movflags +faststart \
  apps/web-auth/public/auth/video-mobile.mp4

# Poster: first frame at t=0.5s, JPEG quality 80
ffmpeg -i /tmp/auth-source.mp4 -ss 00:00:00.5 -vframes 1 -q:v 3 \
  apps/web-auth/public/auth/video-poster.jpg
```

Confirm output sizes: desktop ≤ 4 MB, mobile ≤ 2 MB, poster ≤ 120 KB. Commit only the three files under `apps/web-auth/public/auth/` (the source is `.gitignore`d via `/tmp/`).

Cite: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video> for `preload` + `poster` semantics; <https://web.dev/articles/lcp> for the LCP poster pattern.

### Step 4 — Feature folder scaffold

Create `apps/web-auth/src/features/auth/` following Bulletproof React:

```
features/auth/
├── api/
│   ├── sign-in.ts
│   ├── sign-up.ts
│   └── forgot-password.ts
├── components/
│   ├── auth-layout.tsx
│   ├── auth-video-panel.tsx
│   ├── auth-card.tsx
│   ├── auth-footer.tsx
│   ├── header-actions.tsx
│   ├── oauth-button-group.tsx
│   ├── password-input.tsx
│   ├── password-strength-meter.tsx
│   ├── verification-code-input.tsx
│   ├── clerk-captcha.tsx
│   ├── sign-in-form.tsx
│   ├── sign-up-form.tsx
│   ├── verification-step.tsx
│   ├── forgot-password-form.tsx
│   └── *.test.tsx                   # colocated tests
├── types/
│   └── flow-state.ts                # discriminated unions
└── utils/
    ├── clerk-error.ts
    └── password-rules.ts
```

No barrel files. Each component file has a single named export matching the file name (kebab-case file, PascalCase export — `code-standards.md`).

### Step 5 — `api/` wrappers (Clerk SDK behind a typed surface)

Each file exports a small set of pure async functions that take the corresponding Clerk hook's `signIn` / `signUp` resource and primitive args, return a typed result discriminated union (`{ status: "complete" } | { status: "needs_verification" } | { status: "needs_factor"; nextFactor: string } | { status: "error"; errors: ClerkAPIError[] }`).

Why a wrapper, not direct hook usage in components: the components stay UI-only; the wrappers carry the protocol knowledge and are individually unit-testable with mocked Clerk resources. Cite Clerk's reference for each call:

- `useSignIn` / `signIn.create({ identifier, password })`, `signIn.authenticateWithRedirect`: <https://clerk.com/docs/reference/clerk-react/usesignin>
- `useSignUp` / `signUp.create({ emailAddress, password })`, `signUp.prepareEmailAddressVerification({ strategy: "email_code" })`, `signUp.attemptEmailAddressVerification({ code })`: <https://clerk.com/docs/reference/clerk-react/usesignup>
- `signIn.resetPasswordEmailCode.sendCode()`, `.verifyCode({ code })`, `.submitPassword({ password, signOutOfOtherSessions: true })`: <https://clerk.com/docs/guides/development/custom-flows/account-updates/forgot-password>

### Step 6 — Components

#### `auth-layout.tsx`

CSS grid:

- Mobile: single column; video card collapses to top banner.
- ≥ `md`: two columns, left = video card, right = form column, footer below spans both.
- Outer wrapper has padding so neither column touches the viewport edges (`p-6 lg:p-8`). The left card uses `m-0` inside this padded container so the user-perceived "floating" effect comes from the parent padding, not nested margins (cleaner DOM).

Skip-to-content link `<a href="#auth-main" class="sr-only focus:not-sr-only ...">` at the top (cite WCAG 2.4.1 Bypass Blocks).

#### `auth-video-panel.tsx`

```html
<aside class="relative overflow-hidden rounded-xl shadow-lg ..." aria-label="Outbound Spotter scene">
  <video
    class="absolute inset-0 h-full w-full object-cover"
    autoplay
    muted
    playsinline
    loop
    preload="metadata"
    poster="/auth/video-poster.jpg"
    aria-label="Aerial view of a long-haul trucking route"
  >
    <source media="(min-width: 1024px)" src="/auth/video-desktop.mp4" type="video/mp4" />
    <source src="/auth/video-mobile.mp4" type="video/mp4" />
  </video>
  <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-6 lg:p-8">
    <h2 class="font-display text-2xl text-white">Drive smarter. Stay compliant.</h2>
    <p class="font-sans text-sm text-white/90">Plan HOS-aware routes and generate FMCSA-ready logs in seconds.</p>
  </div>
</aside>
```

Behaviors:

- `useEffect` reads `window.matchMedia("(prefers-reduced-motion: reduce)")`. If `matches`, the component skips rendering the `<video>` element and shows only the poster as an `<img>` with the same overlay. Subscribes to the media query's `change` event so a runtime preference flip is honored.
- The video has `aria-label`, not `aria-hidden="true"` — it carries meaning (brand atmosphere). Cite: <https://thoughtbot.com/blog/can-auto-playing-videos-be-accessible>.
- The white-on-image text overlay must reach APCA `Lc ≥ 75` over the gradient. The gradient `from-black/70` is required for the chosen image; if the implementer's poster has bright lower regions, increase to `from-black/80`. Spot-check with Chrome DevTools' APCA panel.
- No autoplay sound — `muted` is mandatory for autoplay per WHATWG <https://html.spec.whatwg.org/multipage/media.html#autoplaying>.

#### `auth-card.tsx`

Wraps the right-column form area with shadcn `Card` + `CardHeader` (BrandMark + ThemeToggle row → CardTitle → CardDescription) + `CardContent` (form) + `CardFooter` (secondary links). Uses the full shadcn Card composition per the `shadcn` skill rules.

#### `auth-footer.tsx`

`<footer>` with three dead links: Privacy Policy (`/privacy`), Terms of Service (`/terms`), Copyright `© {new Date().getFullYear()} Outbound Spotter`. Each link is `href="#"` with `onClick={(e) => e.preventDefault()}` — explicitly dead, not a broken navigation. `aria-disabled` is **not** set (the WAI-ARIA APG guidance reserves it for actually disabled controls). Add a small `<sup>` or text indicating placeholder if the design wants honesty; otherwise leave unmarked per the user's "decoration" requirement.

#### `header-actions.tsx`

Row with `<BrandMark variant="full" />` on the left and `<ThemeToggle />` on the right. The brand mark sizes to `h-8` (~32 px) so it reads as a header-level brand without overpowering the form.

#### `oauth-button-group.tsx`

Two full-width `Button variant="outline" size="default"` buttons, stacked vertically with a `gap-2`:

- "Continue with Google" — Google G-logo as inline SVG (from Google Identity guidelines, monochrome variant on light bg, multicolor variant per <https://developers.google.com/identity/branding-guidelines>).
- "Continue with Apple" — Apple logo as inline SVG (Apple HIG: <https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple/overview/buttons/>).

Both call `signIn.authenticateWithRedirect({ strategy, redirectUrl: "/sso-callback", redirectUrlComplete: env.VITE_APP_URL })` (or the equivalent `signUp.authenticateWithRedirect` when used on `/sign-up`). The component receives `mode: "sign-in" | "sign-up"` and the resource via context, not props, to avoid prop-drilling. Cite OAuth flow: <https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections>.

Buttons display a loading spinner (`SpotterLoader size="sm"` slotted via `data-icon`) when the redirect is initiated.

#### `password-input.tsx`

Composes shadcn `Input` + a trailing `Button variant="ghost" size="icon"` for show/hide:

- Wrapped in `InputGroup` + `InputGroupInput` + `InputGroupAddon` (per `context/ui-context.md`'s rule: "Buttons inside inputs use `InputGroup` + `InputGroupAddon`"). If those primitives are not yet installed in spec 01, install them now and treat as a small carry-over (the `shadcn` skill confirms `input-group` is a separate `shadcn add`).
- Toggle button:
  - `aria-pressed={visible}`, label `"Show password"` (constant, visually hidden).
  - Icon swap: `EyeOff` when hidden, `Eye` when visible (lucide-react).
  - On click, toggles `type` between `"password"` and `"text"`. Cite <https://www.w3.org/WAI/ARIA/apg/patterns/button/>.
- Props: `autoComplete?: "current-password" | "new-password" | "one-time-code"` — the consumer chooses based on flow context.
- `forwardRef` for RHF registration.

#### `password-strength-meter.tsx`

Renders five segments (one for "empty", four for zxcvbn scores 1–4). Active segment count = `score + 1`; color escalates from `--muted` → `--destructive` → `--chart-2` → `--primary` (rough mapping; the implementer picks tokens that maintain `Lc ≥ 60`).

API:

```ts
type Props = { value: string; userInputs?: string[]; onScoreChange?: (score: 0 | 1 | 2 | 3 | 4) => void };
```

Implementation:

- Memoize zxcvbn-ts setup once at module load (`options` with `language-common` + `language-en` dictionaries + the `userInputs` extra dictionary from the consumer — typically `[email.split("@")[0]]` so "myname@gmail.com" / "myname123" scores low).
- Debounce evaluation to ~150 ms so keystrokes don't thrash the meter.
- Use `aria-live="polite"` on a sibling status message ("Strength: good") so a screen reader announces the level on change (debounced 1 s so it doesn't fire per keystroke).
- The submit button on the sign-up form is _not_ disabled by the meter (per inclusive-design guidance: never disable submit on perceived weakness — let the server's response be authoritative). Instead, a weak password submission produces a client-side inline error via RHF + zod, suppressing the network call only when score < 3.

Cite: <https://github.com/zxcvbn-ts/zxcvbn> + <https://clerk.com/docs/guides/secure/password-protection-and-rules>.

#### `verification-code-input.tsx`

Six adjacent `Input` cells, each accepting one digit:

- `inputMode="numeric"`, `pattern="[0-9]*"`, `autoComplete="one-time-code"` (the standard for OTP cells per WHATWG autofill spec).
- Typing a digit auto-advances focus to the next cell; backspace on an empty cell moves focus back.
- Paste handler: if the clipboard contains a 6-digit string, distribute across cells and submit.
- The whole group registers as a single field with RHF; under the hood the value is the joined string.
- A11y: each cell has an `aria-label="Digit N of 6"`; the wrapper has `role="group"` + `aria-labelledby` pointing to a visible label "Verification code".

#### `clerk-captcha.tsx`

Renders exactly one `<div id="clerk-captcha" />` element in the sign-up form's DOM, positioned between the password field and the submit button. The element must exist _before_ `signUp.create()` runs — Clerk's frontend SDK looks up the element by id at call time and renders the Turnstile iframe into it if needed.

Cite: <https://clerk.com/docs/guides/secure/bot-protection> and <https://clerk.com/docs/js-frontend/guides/development/custom-flows/authentication/bot-sign-up-protection>.

The CAPTCHA is only on `/sign-up` (per Clerk's recommendation). `/sign-in` and `/forgot-password` rely on server-side abuse heuristics.

#### `sign-in-form.tsx`

State machine (discriminated union from `types/flow-state.ts`):

```ts
type SignInState = { phase: "idle" } | { phase: "submitting" } | { phase: "error"; errors: ClerkAPIError[] };
```

Layout (top → bottom):

1. `BrandMark` + `ThemeToggle` (via `header-actions.tsx`).
2. `CardTitle`: "Welcome back".
3. `CardDescription`: "Sign in to Outbound Spotter".
4. `OAuthButtonGroup mode="sign-in" />`.
5. `Separator` with text "or".
6. Email `Field` (`autoComplete="email"`, `inputMode="email"`, `spellCheck={false}`, `autoCorrect="off"`).
7. `PasswordInput` (`autoComplete="current-password"`) with a "Forgot password?" link aligned right inside the field's `FieldDescription` area (or below — pick whichever the shadcn Field primitive supports cleanly).
8. Submit `Button` ("Sign in") — full width, loading state shows `SpotterLoader size="sm"` via `data-icon`.
9. CardFooter: "Don't have an account? Create one" → `/sign-up`.

A11y:

- `aria-live="assertive"` region above the form for `ClerkAPIError[]` from a failed `signIn.create()`.
- Inline `FieldError` for per-field validation errors (RHF + zod schema requires non-empty email + non-empty password).
- Focus stays in the offending field on inline validation errors; submission failure scrolls the assertive region into view.

#### `sign-up-form.tsx`

Owns the inline verification transition.

```ts
type SignUpState =
  | { phase: "collect" }
  | { phase: "verifying"; emailAddress: string }
  | { phase: "complete" }
  | { phase: "error"; errors: ClerkAPIError[] };
```

When `phase === "collect"`:

1. `BrandMark` + `ThemeToggle`.
2. CardTitle: "Create your account".
3. CardDescription: "Start planning compliant trips".
4. `OAuthButtonGroup mode="sign-up" />`.
5. `Separator` ("or").
6. Email field (same a11y attrs as sign-in).
7. `PasswordInput autoComplete="new-password"` paired with `PasswordStrengthMeter` reading the same field's value via RHF `watch`.
8. `ClerkCaptcha />` (the Turnstile mount point).
9. Submit "Create account" — disabled only while `phase === "submitting"`, never on perceived weakness.
10. CardFooter: "Already have an account? Sign in" → `/sign-in`.

On submit:

- Run client-side zod validation (email valid; password length ≥ 10; strength score ≥ 3 via the resolver custom rule).
- Call `signUp.create({ emailAddress, password })`. Catch `ClerkAPIError`s (including breached-password from HIBP — Clerk error code `form_password_pwned`) and surface them in the assertive region + the relevant `FieldError`.
- On success, `signUp.prepareEmailAddressVerification({ strategy: "email_code" })` and transition to `phase: "verifying"`.

When `phase === "verifying"`, render `<VerificationStep emailAddress={state.emailAddress} onBack={...} />`.

#### `verification-step.tsx`

Layout:

1. `BrandMark` + `ThemeToggle`.
2. CardTitle: "Check your email".
3. CardDescription: "We sent a 6-digit code to {emailAddress}. Enter it below to finish."
4. `VerificationCodeInput />`.
5. Submit "Verify".
6. Secondary: "Didn't get the code? Resend" (calls `signUp.prepareEmailAddressVerification` again; cool-down 30 s, visible countdown).
7. Tertiary: "Use a different email" — calls `onBack` to return the parent form to `phase: "collect"`.

On submit:

- `signUp.attemptEmailAddressVerification({ code })`.
- On `status === "complete"`: `setActive({ session: createdSessionId })` (the session id is on the `signUp` resource), then `window.location.assign(env.VITE_APP_URL)`. Use a hard navigation (not React Router) because we're crossing to the satellite domain.
- On error: surface in the assertive region.

Focus management: on mount, focus moves to the first OTP cell. Subscribed via a `useEffect` + `ref.current?.focus()`.

#### `forgot-password-form.tsx`

State machine:

```ts
type ForgotPasswordState =
  | { phase: "request" }
  | { phase: "verifying"; emailAddress: string }
  | { phase: "reset"; emailAddress: string }
  | { phase: "complete" };
```

- `phase: "request"` — email field + submit. On submit: `signIn.create({ identifier: emailAddress })` then `signIn.resetPasswordEmailCode.sendCode()`; transition to `verifying`.
- `phase: "verifying"` — `VerificationCodeInput`. On submit: `signIn.resetPasswordEmailCode.verifyCode({ code })`; transition to `reset`.
- `phase: "reset"` — new `PasswordInput` (`autoComplete="new-password"`) + `PasswordStrengthMeter` + confirm-password field. On submit: `signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true })`, then `signIn.finalize()` (Clerk auto-signs the user in). Hard-redirect to `env.VITE_APP_URL`.

Cite the full sequence: <https://clerk.com/docs/guides/development/custom-flows/account-updates/forgot-password>.

### Step 7 — Route files

Rewrite the three route files; each is a thin shell:

```tsx
// apps/web-auth/src/app/routes/sign-in.tsx
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export function SignInRoute() {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}
```

Same shape for `sign-up.tsx` (renders `<SignUpForm />`) and `forgot-password.tsx` (renders `<ForgotPasswordForm />`).

Wire the new routes in `apps/web-auth/src/app/router.tsx`:

```ts
[
  { path: "/", element: <Navigate replace to="/sign-in" /> },
  { path: "/sign-in/*", element: <SignInRoute /> },
  { path: "/sign-up/*", element: <SignUpRoute /> },
  { path: "/forgot-password", element: <ForgotPasswordRoute /> },
  { path: "/sso-callback", element: <SsoCallbackRoute /> },
  { path: "*", element: <Navigate replace to="/sign-in" /> },
]
```

### Step 8 — Provider wrap

Update `apps/web-auth/src/app/provider.tsx`:

- Wrap the existing `<ClerkProvider>` with `<ThemeProvider defaultTheme="system">` from `@outbound/ui/components/theme/theme-provider`. The theme must be available to portal'd content (toasts, dialogs), and `<ClerkProvider>` mounts its own portal root for redirects — `ThemeProvider` on the outside keeps the `.dark` class on `<html>` visible to everything.
- Mount a single `<Toaster />` from `@outbound/ui/components/ui/sonner` (per `shadcn` skill: "Mount a single `<Toaster />` in `app/provider.tsx`").

No other provider changes.

### Step 9 — Tests

**Unit tests** (Vitest + RTL, colocated `*.test.tsx`):

For each component file in `features/auth/components/`, at minimum:

- Rendering: defaults, custom props.
- A11y: roles, labels, `aria-pressed`/`aria-live`/`aria-invalid` per the component's contract.
- Interaction: keyboard, paste, focus management on flow transitions.

For each `api/*.ts` wrapper:

- Golden path return value.
- Error mapping (Clerk error codes → typed result).
- Edge cases: `setActive` not called on incomplete status.

**Integration tests** (`apps/web-auth/src/testing/`):

- `clerk-mocks.ts` — exports `mockClerk({ signInResult, signUpResult, … })` returning the resource objects with stubbed methods.
- `handlers.ts` — MSW 2 handlers for any Clerk frontend API endpoint the SDK calls (e.g., `POST /v1/client/sign_ins`, `POST /v1/client/sign_ups`, `POST /v1/client/sign_ups/:id/prepare_verification`, …). Use Clerk's documented endpoints; cite the FAPI reference where possible: <https://clerk.com/docs/reference/frontend-api/>.
- Per-flow scenario file: `sign-in.flow.test.tsx`, `sign-up.flow.test.tsx`, `forgot-password.flow.test.tsx`. Each walks through the golden path and at least one error path.

### Step 10 — End-to-end via Playwright MCP

The implementer starts the dev servers:

```bash
pnpm dev --filter=web-auth --filter=web-app
```

Then drives every row of the §"E2E test matrix" through the **Playwright MCP** attached to the session. Each row is scripted as an MCP-driven user journey: the session opens a real browser, simulates a real user, captures screenshots / DOM snapshots / a trace for each scenario, and attaches the artifacts to the PR body. No Playwright source files are committed to the repo — the MCP is the runner. The unit is not complete until every row's MCP run is green or explicitly waived with cause documented in the PR.

### Step 11 — Clerk instance configuration via CLI

The project's Clerk env vars (see Prerequisites) are already populated with real instance keys, so the session can drive Clerk's Backend / Platform API directly. The implementer invokes the `clerk` skill (see `.agents/skills/clerk/SKILL.md`), runs `clerk doctor` first to confirm the resolved instance, then applies each setting below via the CLI and captures the command + JSON response in the PR body so the reviewer can verify instance state without dashboard access:

- [ ] Google OAuth SSO connection enabled and bound to the project's Google Cloud OAuth client.
- [ ] Apple OAuth SSO connection enabled (Apple Services ID + key configured; the Clerk-issued return URL is then pasted into the Apple Developer console — that one step requires Apple-portal access, not Clerk).
- [ ] Bot protection: "Sign-up bot protection" ON; "Sign-in bot protection" left at the Clerk default.
- [ ] Password rules: minimum length 10, require lowercase + uppercase + number, "Block compromised passwords" (HIBP) ON.
- [ ] Email verification strategy: `email_code` active.
- [ ] Redirect-URL allowlist includes `auth.<host>/sso-callback`, `app.<host>`, and the local-dev equivalents (`http://localhost:5173`, `http://localhost:5174/sso-callback`).
- [ ] The active Clerk instance is the **development** instance; production-instance changes are gated behind the deploy spec.

If a setting cannot be applied via the CLI surface at execution time (Clerk's Platform API coverage evolves), fall back to the corresponding dashboard step and document the escape hatch in the PR body. Either way, the user does not perform manual dashboard work — the session owns the operation end-to-end.

## File-level deliverables (summary)

```
apps/web-auth/
├── .env.local.example                                      # NEW
├── public/auth/
│   ├── video-desktop.mp4                                   # NEW
│   ├── video-mobile.mp4                                    # NEW
│   └── video-poster.jpg                                    # NEW
└── src/
    ├── app/
    │   ├── provider.tsx                                    # MODIFY — wrap with ThemeProvider, mount Toaster
    │   ├── router.tsx                                      # MODIFY — add forgot-password + index routes
    │   └── routes/
    │       ├── sign-in.tsx                                 # REWRITE — thin shell
    │       ├── sign-up.tsx                                 # REWRITE — thin shell
    │       ├── forgot-password.tsx                         # NEW — thin shell
    │       ├── sso-callback.tsx                            # KEEP
    │       └── index.tsx                                   # NEW — Navigate replace
    ├── config/
    │   ├── env.ts                                          # MODIFY — add VITE_SUPPORT_EMAIL
    │   └── paths.ts                                        # MODIFY — add forgotPassword, root
    ├── features/auth/
    │   ├── api/
    │   │   ├── sign-in.ts                                  # NEW
    │   │   ├── sign-in.test.ts                             # NEW
    │   │   ├── sign-up.ts                                  # NEW
    │   │   ├── sign-up.test.ts                             # NEW
    │   │   ├── forgot-password.ts                          # NEW
    │   │   └── forgot-password.test.ts                     # NEW
    │   ├── components/
    │   │   ├── auth-layout.tsx                             # NEW
    │   │   ├── auth-layout.test.tsx                        # NEW
    │   │   ├── auth-video-panel.tsx                        # NEW
    │   │   ├── auth-video-panel.test.tsx                   # NEW
    │   │   ├── auth-card.tsx                               # NEW
    │   │   ├── auth-card.test.tsx                          # NEW
    │   │   ├── auth-footer.tsx                             # NEW
    │   │   ├── auth-footer.test.tsx                        # NEW
    │   │   ├── header-actions.tsx                          # NEW
    │   │   ├── header-actions.test.tsx                     # NEW
    │   │   ├── oauth-button-group.tsx                      # NEW
    │   │   ├── oauth-button-group.test.tsx                 # NEW
    │   │   ├── password-input.tsx                          # NEW
    │   │   ├── password-input.test.tsx                     # NEW
    │   │   ├── password-strength-meter.tsx                 # NEW
    │   │   ├── password-strength-meter.test.tsx            # NEW
    │   │   ├── verification-code-input.tsx                 # NEW
    │   │   ├── verification-code-input.test.tsx            # NEW
    │   │   ├── clerk-captcha.tsx                           # NEW
    │   │   ├── clerk-captcha.test.tsx                      # NEW
    │   │   ├── sign-in-form.tsx                            # NEW
    │   │   ├── sign-in-form.test.tsx                       # NEW
    │   │   ├── sign-up-form.tsx                            # NEW
    │   │   ├── sign-up-form.test.tsx                       # NEW
    │   │   ├── verification-step.tsx                       # NEW
    │   │   ├── verification-step.test.tsx                  # NEW
    │   │   ├── forgot-password-form.tsx                    # NEW
    │   │   └── forgot-password-form.test.tsx               # NEW
    │   ├── types/
    │   │   └── flow-state.ts                               # NEW
    │   └── utils/
    │       ├── clerk-error.ts                              # NEW
    │       ├── clerk-error.test.ts                         # NEW
    │       ├── password-rules.ts                           # NEW
    │       └── password-rules.test.ts                      # NEW
    └── testing/
        ├── clerk-mocks.ts                                  # NEW
        ├── handlers.ts                                     # NEW
        ├── sign-in.flow.test.tsx                           # NEW
        ├── sign-up.flow.test.tsx                           # NEW
        └── forgot-password.flow.test.tsx                   # NEW
```

## Accessibility floor (WCAG 2.2 AA contract)

- Every form field wrapped in shadcn `Field` + `FieldLabel`; errors via `FieldError`; `data-invalid` mirrors to `aria-invalid`.
- Email: `autocomplete="email"`, `inputmode="email"`, `spellcheck="false"`, `autocorrect="off"` (WHATWG autofill: <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>).
- Password sign-in: `autocomplete="current-password"`. Sign-up / reset: `autocomplete="new-password"`. OTP cells: `autocomplete="one-time-code"`.
- `aria-live="polite"` for confirmations ("Verification code sent"). `aria-live="assertive"` for server errors. Each screen owns exactly one of each. (ARIA19: <https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19>.)
- Show/hide password: button with `aria-pressed`, constant label, icon swap (APG button pattern).
- Theme toggle: button with `aria-pressed`, constant label, icon swap.
- Focus management: on flow transition (sign-up `collect → verifying`, forgot-password `request → verifying → reset`), focus moves to the first interactive element of the new phase. On inline validation error, focus stays in the offending field.
- Skip-to-content link at the top of `AuthLayout` (WCAG 2.4.1).
- Touch targets ≥ 24 × 24 CSS px (default dense `Button h-8` already satisfies; verify any `size="icon"` buttons clear the threshold).
- Color contrast: APCA Lc ≥ 75 body, Lc ≥ 60 UI per `context/ui-context.md`. The white-on-video overlay is the highest-risk pair; the dark gradient under it must be tuned to maintain Lc ≥ 75.
- All `<Dialog>` / `<Sheet>` instances (currently none in this unit) ship a Title; none anticipated.
- Reduced motion: every animation respects `prefers-reduced-motion` — the video, the SpotterLoader (from spec 01), and any state-transition tween.
- Keyboard traversal order: skip link → theme toggle → first form field → … → submit → secondary links → footer links.
- Lang attribute: `<html lang="en">` (verify in `apps/web-auth/index.html`).
- Tab keys never trap inside the verification OTP group; the user can shift-tab back to the email field if needed.

## Testing strategy

- **Unit** — Vitest 4 + Testing Library 16 + jsdom; one spec file per component / wrapper. AAA structure with blank lines between phases (`code-standards.md`). Query order: `getByRole > getByLabelText > getByText > getByTestId`.
- **Integration** — MSW 2 handlers stub Clerk's frontend API; per-flow `*.flow.test.tsx` walk the user through the golden path and at least one error path. Use `userEvent` (not `fireEvent`).
- **`@clerk/testing`** — if the package supports v6 React at install time (verify via <https://clerk.com/docs/guides/development/testing/overview>), prefer its `mockClerkClient` / `setupClerkTestingTokens` utilities over hand-rolled mocks.
- **End-to-end (Playwright MCP)** — every row in §"E2E test matrix" is exercised by the session-attached Playwright MCP, driving a real browser against the running `web-auth` + `web-app` dev servers. Each scenario is scripted as an MCP-driven user journey; screenshots, DOM snapshots, and the resulting trace are attached to the PR body. No Playwright source is committed — the MCP is the runner, not a test framework in the repo.
- **`react-doctor`** — run on the diff before PR. The skill's score must not regress.

## E2E test matrix (Playwright MCP — every row exercised in-session, artifacts attached to PR)

- [ ] Sign-in email + password golden path → redirected to `app.<host>`.
- [ ] Sign-in wrong-password error → assertive region announces, focus stays on password.
- [ ] Sign-in "Forgot password?" link → lands on `/forgot-password`.
- [ ] Sign-in Google OAuth → Google consent → `/sso-callback` → `app.<host>`.
- [ ] Sign-in Apple OAuth → Apple consent → `/sso-callback` → `app.<host>`.
- [ ] Sign-up email + password (strong) → Turnstile challenge appears if Clerk triggers → verification step.
- [ ] Sign-up weak password (zxcvbn score < 3) rejected client-side; submit button stays enabled but submission is blocked with `FieldError`.
- [ ] Sign-up known-breached password rejected by Clerk (HIBP) with the right error message.
- [ ] Sign-up email-code verification: code typed → continue to `app.<host>`.
- [ ] Sign-up email-code verification: paste a 6-digit code → auto-submit.
- [ ] Sign-up resend code: 30 s cool-down enforced, then succeeds.
- [ ] Sign-up "Use a different email" returns to the collect phase with the form pristine.
- [ ] Forgot-password full cycle: email → code → new password → redirect.
- [ ] Forgot-password with a non-registered email — Clerk's response must not leak existence; the UI advances to the verifying phase regardless (per OWASP user-enumeration guidance: <https://owasp.org/www-community/attacks/Forced_browsing> and the Clerk docs).
- [ ] Dark/light toggle persists across reload.
- [ ] First visit respects `prefers-color-scheme`.
- [ ] `prefers-reduced-motion: reduce` disables the video, shows poster only.
- [ ] Keyboard-only traversal: every interactive element reachable in logical order.
- [ ] Browser zoom 200%: layout still readable, no overlap.
- [ ] Chrome DevTools APCA panel: every text-on-surface pair clears Lc 75 / 60.
- [ ] Screen reader walkthrough (VoiceOver on macOS or NVDA on Windows): assertive region announces errors; polite region announces confirmations; OTP cells announce digit positions.

## Sub-agents to invoke

Per `context/ai-workflow-rules.md#Sub-agents`:

- `code-reviewer` (`comprehensive-review`) — mandatory.
- `architect-review` (`comprehensive-review`) — required: this unit adds a new feature folder with API + components + flow state.
- `security-auditor` (`comprehensive-review`) — required: auth + JWT setup, Turnstile mount, OAuth redirect URLs, redirect-URL whitelisting, breached-password handling, ORS proxy out of scope.
- `ui-visual-validator` (`accessibility-compliance`) — required.
- `performance-optimizer` (`application-performance`) — required: the unit adds the video panel (a new heavy asset path); verify LCP < 2.5 s on a throttled 3G profile.

Skills that should fire automatically: `react-architecture`, `react-doctor`, `shadcn` (composition rules), `clerk` (custom flow patterns).

## Citations

The implementer cites each of these inline (as a brief code comment where the WHY is non-obvious — per `code-standards.md`'s comment policy) or in the PR body under "Citations":

**Clerk Core 3 / `@clerk/react` v6**

- `useSignIn`: <https://clerk.com/docs/reference/clerk-react/usesignin>
- `useSignUp`: <https://clerk.com/docs/reference/clerk-react/usesignup>
- Custom email + password: <https://clerk.com/docs/guides/development/custom-flows/authentication/email-password>
- Custom OAuth: <https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections>
- Apple SSO setup: <https://clerk.com/docs/guides/configure/auth-strategies/social-connections/apple>
- Forgot password: <https://clerk.com/docs/guides/development/custom-flows/account-updates/forgot-password>
- Bot protection: <https://clerk.com/docs/guides/secure/bot-protection> and <https://clerk.com/docs/js-frontend/guides/development/custom-flows/authentication/bot-sign-up-protection>
- Password rules + HIBP: <https://clerk.com/docs/guides/secure/password-protection-and-rules>
- Satellite domains: <https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains>
- Redirect URL semantics: <https://clerk.com/docs/guides/development/customize-redirect-urls>
- Frontend API reference: <https://clerk.com/docs/reference/frontend-api/>
- `@clerk/testing`: <https://clerk.com/docs/guides/development/testing/overview>

**Video + motion + accessibility**

- `<video>` element: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video>
- LCP poster pattern: <https://web.dev/articles/lcp>
- Autoplay rules (muted requirement): <https://html.spec.whatwg.org/multipage/media.html#autoplaying>
- `prefers-reduced-motion`: <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- W3C C39 reduce-motion technique: <https://www.w3.org/WAI/WCAG22/Techniques/css/C39>
- HTML `autocomplete`: <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>
- WCAG H98 autocomplete: <https://www.w3.org/WAI/WCAG21/Techniques/html/H98>
- ARIA APG button toggle: <https://www.w3.org/WAI/ARIA/apg/patterns/button/>
- ARIA19 live regions: <https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19>
- WCAG 2.4.1 Bypass Blocks: <https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html>
- Video a11y patterns: <https://thoughtbot.com/blog/can-auto-playing-videos-be-accessible>

**Brand**

- Google Sign-In branding guidelines: <https://developers.google.com/identity/branding-guidelines>
- Apple Sign-in HIG: <https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple/overview/buttons/>

**Tooling**

- shadcn CLI: <https://ui.shadcn.com/docs/cli>
- shadcn login-02 reference layout: <https://ui.shadcn.com/view/new-york-v4/login-02>
- React Hook Form: <https://react-hook-form.com/>
- zxcvbn-ts: <https://github.com/zxcvbn-ts/zxcvbn>
- MSW 2: <https://mswjs.io/docs/>

## Verification

Mirrors `context/ai-workflow-rules.md#Verification before moving to the next unit`:

- [ ] `pnpm exec turbo run lint typecheck test build --filter=web-auth --affected` is green.
- [ ] `pnpm format:check` is green.
- [ ] `pnpm exec turbo run typecheck test --affected` covers any indirect consumers (none expected — `web-app` is untouched).
- [ ] E2E test matrix fully exercised via Playwright MCP in-session; MCP artifacts (screenshots, DOM snapshots, trace) attached to PR body.
- [ ] Clerk instance configuration applied via the `clerk` CLI in-session; command outputs captured in PR body.
- [ ] `code-reviewer`, `architect-review`, `security-auditor`, `ui-visual-validator`, `performance-optimizer` all ran; no unresolved CRITICAL findings.
- [ ] `react-doctor` score does not regress vs. pre-unit baseline.
- [ ] No hex literals in components; no `dark:` overrides; no cross-feature imports.
- [ ] No `Co-Authored-By` trailer in any commit; no `--no-verify`.
- [ ] PR opens against `develop`; branch name `feat/02-clerk-auth-screens`.
- [ ] `context/progress-tracker.md` updated as the **last** file in the PR.

## Out of scope (deliberate)

- MFA flows, account-management UI, organization invites, magic links.
- Anything in `apps/web-app` beyond the auth-back-redirect that already works.
- Django middleware to verify Clerk JWTs on `web-api` — its own spec when the first protected endpoint ships.
- The HOS planner and any FMCSA log surface (`docs/interstate-truck-driver-guide.md`) — separate specs.
- Committed Playwright source / `@playwright/test` as a repo dependency — E2E is driven by the Playwright MCP at session time, not by an in-repo test runner.

## Open Questions

The implementer must resolve this before opening the PR:

1. **`@clerk/testing` v6 support.** Verify the package supports `@clerk/react` v6 React-side mocking at the time of implementation. If not, fall back to hand-rolled `vi.mock("@clerk/react", …)` shims and document the fallback in the PR body. Log the gap in `progress-tracker.md` as a follow-up to revisit once Clerk ships the v6 helpers.

If this question lacks a clear answer at the start of implementation, log it in `context/progress-tracker.md#Open Questions` and ping the user.
