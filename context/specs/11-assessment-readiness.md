# 11 — Assessment Readiness: Resilience Floor + UX Polish + A11y Pass

> Closes the gap between "feature-complete v1 alpha" and "reviewer-grade product" before the assessment reviewer starts clicking the deployed app. Three sequential phases land under one spec, each on its own branch off `develop` (mirrors spec 10's `10a/10b/10c` precedent). **Phase 11a — Resilience floor**: multi-layered React error boundaries across `web-app` + `web-auth`, an on-brand 404 inside the app shell, consistent `Toaster` configuration across both apps, and a shared `reportableError()` helper. **Phase 11b — UX polish**: "Use my current location" (US-only, with a tiny new `/api/geocode/reverse/` endpoint), per-user recent-locations pre-populating the autocomplete, a day-by-day `<Collapsible>` breakdown, an in-dialog PDF preview, a global synced clock in the top bar, "Why this stop?" tooltips on the stops list (cite §395), an AssumptionsBanner restating the brief's premises verbatim, a non-ELD planning disclaimer, and theme persistence keyed per Clerk user. **Phase 11c — A11y pass**: `eslint-plugin-jsx-a11y` in the shared flat config, `jest-axe` matchers wired into Vitest 4 for three key surfaces, and an `accessibility-compliance:ui-visual-validator` run across every UI-touched route, with findings tabled at the bottom of this spec. Architecture invariant #6 (PDF export client-only) is preserved; invariant #1 (HOS planner pure) is untouched.

## Goal

After spec 11 ships across its three branches, the application is **assessment-review-ready**:

1. **No white-screen crashes.** Any React render exception is caught — by the app-level boundary (catastrophic), the route-level boundary (recoverable inside a single route), or the feature-level boundary (`<TripMap />`, `<DailyLogSheetsStrip />` — recoverable inline). 404s render an on-brand page inside the app shell instead of a blank route.
2. **Reviewer can see what they're looking at.** The trip-detail page opens with an `AssumptionsBanner` quoting the four assumptions from `docs/assesment.md` verbatim ("Property-carrying driver, 70hrs/8days, no adverse driving conditions", "Fueling at least once every 1,000 miles", "1 hour for pickup and drop-off"). A `PlanningDisclaimer` strip at the bottom of the page (and embedded as a footer in the PDF) reads "This is a planning tool, not an ELD. Consult your carrier's FMCSA-certified ELD for the legal record."
3. **Reviewer can use the app faster.** "Use my current location" populates the current-location field via `navigator.geolocation` + a new `/api/geocode/reverse/` proxy. Recent locations (last 3, per Clerk user, in `localStorage`) pre-populate the autocomplete combobox when the input is empty. A global synced clock in the top bar shows home-terminal time. PDF preview-before-download lets the user see what they're committing to.
4. **Reviewer understands every planner decision.** Hovering / focusing any stop in the `StopsList` reveals a tooltip citing the §395 paragraph (or the assignment-brief assumption for pickup/dropoff/fuel). A day-by-day `<Collapsible>` breakdown shows per-day miles / drive hours / on-duty hours / stop counts.
5. **Accessibility is verified, not asserted.** `jsx-a11y/recommended` runs in CI. `jest-axe` assertions cover the trip form, the trip-detail page (post-load), and the exports table. The `ui-visual-validator` sub-agent has reviewed every shipped route and findings are tabled below.

The HOS planner module (`web_api/hos/`) is untouched. No new dependencies land outside the three documented additions (`react-error-boundary@6.1.1`, `eslint-plugin-jsx-a11y@6.10.2`, `jest-axe@10.0.0`). The OpenAPI schema regenerates to include the one new route.

## Architecture invariants check

From `context/architecture.md#invariants`, each item explicitly held against this spec:

- **#1 (HOS planner pure)** — zero touch on `apps/web-api/web_api/hos/`. The new reverse-geocode endpoint lives under `apps/web-api/web_api/apps/geocoding/` (where the existing search/autocomplete endpoints already live, per spec 03). The `test_boundary.py` AST walker continues to pass verbatim.
- **#2 (every duty-status change writes a LogEvent row)** — read-only consumer; no LogEvent shape change.
- **#3 (no raw ORS calls from the browser)** — strengthened. The geolocation feature requires reverse geocoding, which routes through `OrsClient.reverse(...)` inside the existing module; the browser never sees the ORS key. The `/api/geocode/reverse/` view is gated by Clerk JWT + per-user throttle.
- **#4 (no client-side HOS math)** — the new day-by-day breakdown is a pure render of the existing `LogDay` rollups already populated by `hos_adapter.materialize_plan()` (spec 06). The FE adds zero math.
- **#5 (ownership)** — `/api/geocode/reverse/` reuses the project's `_request_user_id` middleware (the same pattern that secures `/api/geocode/search/`). No new ownership surface; no new model writes.
- **#6 (PDF export client-only)** — preserved. The new PDF preview renders the same SVG inline inside the existing `ExportDialog` via the existing `cloneSvgForExport()` helper; no server-side PDF rendering is introduced. The PDF footer disclaimer text is appended client-side inside `renderTripPdf`.
- **#7 (theme tokens only)** — every new component uses semantic tokens (`text-muted-foreground`, `bg-card`, `border-border`, `text-destructive`). No hex literals; no `bg-blue-*` style raw colors; no manual `dark:` overrides.
- **#8 (no custom sub-agents)** — reviews use the wshobson marketplace agents declared in `.claude/settings.json#enabledPlugins`.
- **#9 (specs drive implementation)** — this file is the single source of truth across all three phase branches.

## Decisions of record (resolved at planning time)

Pre-resolved during the spec-11 planning session. Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-polished-nest.md`.

1. **One spec, three phase branches.** `feat/11a-resilience-floor` → `feat/11b-ux-polish` → `feat/11c-a11y-pass`. Mirrors spec 10's `10a/10b/10c` precedent. Sequential because 11b's new `<TripDetailPanel>` children should mount **inside** the feature-error-boundary that 11a establishes, and 11c's lint pass should run after the diff stabilises. Each branch opens its own PR into `develop`; each PR independently passes the `code-reviewer` agent.

2. **Multi-layered error boundary topology (Bulletproof React).** Three distinct layers in `web-app`, two in `web-auth`:
   - **App-level** — wraps `{children}` inside `apps/web-app/src/app/provider.tsx` between `<QueryClientProvider>` and `<Suspense>`. Catches anything not caught downstream (root-component render exceptions). Component: `<AppErrorBoundary>` (uses `react-error-boundary`'s `ErrorBoundary` with a `FallbackComponent` prop).
   - **Route-level** — declared as `errorElement: <RouteErrorElement />` on the layout route and each child route in `apps/web-app/src/app/router.tsx`. Native React Router v7 hook: `useRouteError()` + `isRouteErrorResponse()` to differentiate 404 / 500 / unknown. Verified against installed types at `node_modules/.pnpm/react-router@7.15.1.../dist/development/data-BqZ2x964.d.ts` lines 788–793: both `ErrorBoundary?: ComponentType` and `errorElement?: ReactNode` exist (mutually exclusive). We use `errorElement` (lowercase form) to match the existing `element:` convention in the router and keep the diff minimal.
   - **Feature-level** — wraps `<TripMap />` and `<DailyLogSheetsStrip />` in `apps/web-app/src/app/routes/trips-detail.tsx`. Component: `<FeatureErrorBoundary>` (uses `react-error-boundary`'s `ErrorBoundary` with `onReset` wired to TanStack Query's `useQueryErrorResetBoundary` so "Reload this section" actually refetches the failed query). Renders inline `<Empty>` fallback per `context/ui-context.md` "Callouts → Alert; empty states → Empty".

   web-auth gets app-level + route-level only. No feature-level boundaries — its three forms are small enough that a route-level catch covers them.

3. **Library pin: `react-error-boundary@6.1.1`.** Verified on 2026-05-21 via `curl https://registry.npmjs.org/react-error-boundary/latest`; the package returns `version: "6.1.1"`, peer dep `react: ^18.0.0 || ^19.0.0`, MIT license. The exported API consumed by this spec: `ErrorBoundary`, `useErrorBoundary`, `FallbackProps`. Cite the package README at `https://github.com/bvaughn/react-error-boundary`. The dependency lands in both `apps/web-app/package.json` and `apps/web-auth/package.json` (web-auth needs only the app + route layers; the single import in `app-error-boundary.tsx` is the callsite that justifies the install per `code-standards.md` "Don't add dependencies just-in-case").

4. **404 strategy — in-shell, non-disruptive.**
   - **web-app**: add `{ path: "*", element: <NotFoundRoute /> }` as the **last** child of the layout route in `apps/web-app/src/app/router.tsx`. Because `*` is nested under the layout, the 404 renders **inside** the `AppShellLayout` — sidebar still visible, NavUser still functional. The page itself is an on-brand card with a heading ("We couldn't find that page"), a short message in `text-muted-foreground`, and two CTAs: a `<Button>` "Plan a trip" (links to `/trips/new`) and a `<Button variant="outline">` "Saved trips" (links to `/trips`). The headline + message live in `apps/web-app/src/config/strings.ts` so the same copy can be reused if the 404 ever needs to be rendered elsewhere.
   - **web-auth**: keep the existing `{ path: "*", element: <Navigate to="/sign-in" replace /> }`. Unauthenticated users hitting a mistyped URL benefit from being routed to sign-in (the only thing they can do here is sign in or recover a password); a fancy 404 would be UX noise.

5. **`Toaster` consistency.** Both apps use `sonner@2.0.7` (web-app already imports from `sonner`, web-auth from `@outbound/ui/components/ui/sonner` which re-exports it). web-auth's bare `<Toaster />` in `apps/web-auth/src/app/provider.tsx:16` is replaced with `<Toaster position="bottom-right" richColors closeButton />` to match web-app's existing config at `apps/web-app/src/app/provider.tsx:34`. Cosmetic but the inconsistency would be the first thing a senior reviewer notices.

6. **`reportableError()` helper in `packages/ui`.** Signature: `reportableError(error: unknown, context?: string): void`. Behavior: derives a human message via `error instanceof Error ? error.message : "Something went wrong"`, calls `toast.error(message, { description: context })`, and `console.error("[reportable]", context, error)`. Future Sentry integration plugs in at this one callsite. Location: `packages/ui/src/lib/reportable-error.ts`. Exported via existing barrel-free direct-path imports (`@outbound/ui/lib/reportable-error`). All mutation `onError` callbacks across both apps switch to this helper — touches `plan-trip.ts`, `delete-trip.ts`, `delete-export.ts`, `recreate-export-button.tsx`, plus the new boundaries' `onError`.

7. **Reverse-geocode endpoint — extend the existing `OrsClient`, do not create a sibling.** Per `apps/web-api/web_api/integrations/openrouteservice.py`, the existing client already proxies `/geocode/autocomplete` (line 62) and `/geocode/search` (line 63), with a shared retry session, timeout, and exception taxonomy (`OrsRateLimitError`, `OrsUpstreamError`, etc.). Add `_REVERSE_PATH: Final = "/geocode/reverse"` and a method `def reverse(self, lat: Decimal, lon: Decimal) -> ReverseGeocodeResult` that mirrors `search()`'s implementation:
   - GET against `https://api.openrouteservice.org/geocode/reverse` with query params `point.lat=<lat>`, `point.lon=<lon>`, `boundary.country=US` (the `_BOUNDARY_COUNTRY` constant already in the module), `size=1`, plus the `Authorization` header.
   - Returns the same Pelias feature shape as `search()`: `{ label, lat, lon, confidence }`.
   - Parameter shape and response shape verified against the ORS API playground at `https://openrouteservice.org/dev/#/api-docs/geocode/reverse/get` at spec-implementation time.
   - Uses the existing `_session` (same Retry policy, same `_REQUEST_TIMEOUT_SECONDS`).
   - Reuses the existing exception classes; no new exception type.

8. **DRF view: one APIView, one URL.** `apps/web-api/web_api/apps/geocoding/views.py` gains `GeocodeReverseView(APIView)` with `throttle_classes = (PerUserScopedThrottle,)` and `throttle_scope = "geocode_reverse"`. Validates `lat`/`lon` as `Decimal(9,6)` via a thin `GeocodeReverseRequestSerializer` (mirrors how the search view validates its `text` param). Bound at `path("reverse/", GeocodeReverseView.as_view(), name="reverse")` in `apps/web-api/web_api/apps/geocoding/urls.py`. Response is the same `GeocodeFeature` shape the FE already consumes from `/api/geocode/search/` — no new TS type needed on the client.

9. **New throttle bucket `geocode_reverse = 30/min`.** Sits between `geocode_autocomplete = 60/min` (high-volume typeahead) and `geocode_search = 20/min` (lower-volume committal lookup). Reverse is gesture-bursty (one click → one call) and lower-volume than autocomplete. Added to `apps/web-api/web_api/settings/base.py#REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`. Update `context/architecture.md#Rate limiting` to add the row.

10. **Geolocation — US bounding box, graceful failure.** `useGeolocation()` hook at `apps/web-app/src/features/trip-planner/hooks/use-geolocation.ts` wraps `navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 })` in a Promise. Returns `{ getLocation, status: "idle" | "pending" | "success" | "denied" | "outside-us" | "timeout" | "error", coords, error }`.
    - **US bounding box**: `24 ≤ lat ≤ 71` (continental US + Alaska up to 71° N) and `-180 ≤ lon ≤ -66` (Aleutians to Maine). The Hawaiian islands (lon ≈ -160 to -154) and Puerto Rico (lon ≈ -67 to -65) fall inside. A point outside the box → status `"outside-us"` → toast "Outside the US — please type an address manually." + abort.
    - **PermissionDenied / timeout / position-unavailable** → status set accordingly → `reportableError()` toast + abort. Input stays empty for manual entry; this is the "graceful degradation" the assignment brief implicitly requires.
    - **Coords accepted** → call `/api/geocode/reverse/?lat=&lon=`. The FE client lives at `apps/web-app/src/features/trip-planner/api/geocode-reverse.ts` and exposes a TanStack Query mutation; reuses the existing fetch wrapper.

11. **`UseCurrentLocationButton` mounts inside `AddressField` only when `name === "current"`.** `apps/web-app/src/features/trip-planner/components/address-field.tsx:79` — sibling element next to the `<Popover>`, inside the `<Field>`. Visual: an icon-ghost-button (`<Button variant="ghost" size="sm">` with `LocateFixed` lucide icon in `data-icon`). Loading state replaces the icon with `Loader2` + sets `aria-busy="true"`. Tooltip "Use my current location (US only)". Hidden visually below `sm` breakpoint via `hidden md:inline-flex` only if it would create a layout cramp at narrow widths — first attempt is always-visible since the address field row is already wide.

12. **Recent locations — last 3, per Clerk user, localStorage-backed.**
    - Storage key: `outbound-recent-locations:${clerkUserId}`. The Clerk user id comes from `useUser()` from `@clerk/react`. If the user is somehow not loaded yet (race condition), the hook returns an empty list and skips writes — never throws.
    - `apps/web-app/src/features/trip-planner/hooks/use-recent-locations.ts` exposes `{ recents: GeocodeFeature[]; pushRecent(feature: GeocodeFeature): void }`.
    - `pushRecent` writes the new feature to position 0, removes any existing entry with the same `(lat, lon)` to enforce uniqueness, slices to length 3, JSON-stringifies, and writes to localStorage. Wrapped in try/catch — Safari private mode raises `QuotaExceededError`; we swallow and log via `console.warn` (no UX disruption).
    - `apps/web-app/src/features/trip-planner/components/recent-locations-group.tsx` renders a `<CommandGroup heading="Recent">` inside the existing `<AutocompleteBody>` when `search.length < 3` AND `recents.length > 0`. Replaces the current "Type at least 3 characters" empty state with recents (the message stays as a fallback when both conditions are false).
    - `AddressField.handleSelect` is updated to call `pushRecent(feature)` after a successful pick.

13. **Theme persistence per Clerk user.** `packages/ui/src/components/theme/theme-provider.tsx` accepts an optional `storageKey` prop (default `"outbound-theme"`). `apps/web-app/src/app/provider.tsx` passes `<ThemeProvider storageKey={\`outbound-theme:${user?.id ?? "anonymous"}\`}>`so per-user themes don't leak across accounts on a shared kiosk. web-auth keeps the default unscoped key (no user yet — toggle visible on the sign-in screen). Default theme stays`"system"` per the assessment brief framing ("default to system pref"); the "dark mode for nighttime" framing is a benefit statement to drivers, not a hard override of the default. No BE persistence in v1.

14. **Day-by-day collapsible breakdown.** `apps/web-app/src/features/trip-planner/components/day-breakdown-accordion.tsx` renders a vertical list of `<Collapsible>` items (the `collapsible.tsx` shadcn primitive is already installed at `packages/ui/src/components/ui/collapsible.tsx`). One item per `LogDay` from the trip plan envelope (already returned by `GET /api/trips/<id>/plan/` per spec 06 — no BE work needed).
    - Header row (always visible, click to expand): `date` formatted via `Intl.DateTimeFormat(undefined, { dateStyle: "medium" })`, `miles_driven`, `drive_hours` (computed `driving_s / 3600`, displayed with one decimal), `on_duty_hours` ((driving_s + on_duty_not_driving_s) / 3600, one decimal), and `stop_count` (filter `log_events` for the day where status changes to a stop kind).
    - Expanded body: ordered list of `LogEvent`s for that day, each row showing start time, duty status, location, and the same "Why this stop?" tooltip (Decision 16).
    - Mounted in `TripDetailPanel` (the right-side panel on `/trips/:id`) under a heading "By day", **below** the existing `StopsList`. They coexist — `StopsList` shows the linear chronology; the accordion shows the day-bucket rollup.

15. **PDF preview inside `ExportDialog`.** `apps/web-app/src/features/pdf-export/components/pdf-preview.tsx` renders the first daily-log SVG inline at scaled size (~240 × 320 px target) inside the existing `<Dialog>` body. Reuses the existing `cloneSvgForExport()` helper at `apps/web-app/src/features/pdf-export/lib/clone-svg-for-export.ts` — what the preview shows is exactly what `renderTripPdf` will commit (no preview/output drift).
    - For multi-day trips, a small "Prev / Next" pair of `<Button variant="ghost" size="sm" data-icon>` controls + a "Page X of N" caption let the user flip through pages.
    - The preview renders **inside** the dialog body, above the existing mode `ToggleGroup` + below the dialog title.
    - For the single-page mode, the preview shows the entire stacked-page SVG scaled to fit (no pagination control needed).
    - When the user clicks "Export", the existing `useExportPdf()` hook runs unchanged. The preview is purely visual.

16. **"Why this stop?" tooltips on `StopsList`.** `apps/web-app/src/features/trip-planner/components/why-this-stop-tooltip.tsx` exports a `<WhyThisStopTooltip>` that wraps any child with shadcn's `<Tooltip>` and reads from `STOP_KIND_META[kind].reason`. The existing `apps/web-app/src/features/trip-planner/utils/stop-kind-labels.ts` is **extended** (not rewritten) so driver stops also have a `reason`:
    - `pickup: "1 hr on-duty (not driving) — assignment brief assumes 1 hour for pickup."`
    - `dropoff: "1 hr on-duty (not driving) — assignment brief assumes 1 hour for drop-off."`
    - `fuel: "On-duty (not driving) — assignment brief assumes fueling at least once every 1,000 miles."`
    - Existing kinds (`break`, `sleeper`, `restart`) already cite §395.3 paragraphs — keep verbatim.
    - The `MarkerPopup` on the map (`apps/web-app/src/features/trip-planner/components/marker-popup.tsx`) reads the same constant — extending it surfaces driver-stop reasons in popups too (free win).
    - The `StopsList` rows (`stops-list.tsx#StopRow`) gain the tooltip wrapper. Hover OR keyboard-focus surfaces the reason.

17. **Assumptions banner — `<Alert>`, dismissible per-trip.** `apps/web-app/src/features/trip-planner/components/assumptions-banner.tsx` uses the shadcn `<Alert>` primitive (already installed at `packages/ui/src/components/ui/alert.tsx`). Content is **four bullet points** copied verbatim from `docs/assesment.md` lines 17–20:
    - "Property-carrying driver, 70hrs/8days, no adverse driving conditions."
    - "Fueling at least once every 1,000 miles"
    - "1 hour for pickup and drop-off"
    - "US interstate routes" (paraphrased from `context/project-overview.md#Scope`)
    - Mounted at the top of the trip-detail page, above the `<Tabs>` containing Map / Log Sheets.
    - Dismissible via an `X` icon button. Dismissal persists to `localStorage[outbound-assumptions-dismissed:${tripId}]`. Reopening the same trip respects the dismissal; opening a different trip re-shows the banner (per-trip key — non-stale).
    - The dismiss button gets an `aria-label="Dismiss assumptions banner"` (WCAG 1.3.1 / 2.4.4).

18. **Planning disclaimer — text strip + PDF footer.** Single copy lives in `apps/web-app/src/config/strings.ts#PLANNING_DISCLAIMER` (the new config file from Decision 4):

    ```ts
    export const PLANNING_DISCLAIMER =
      "This is a planning tool, not an ELD. Consult your carrier's FMCSA-certified ELD for the legal record.";
    ```

    - `apps/web-app/src/features/trip-planner/components/planning-disclaimer.tsx` renders the string in `text-muted-foreground text-xs` inside a `<p>` at the bottom of the trip-detail page (below the day breakdown).
    - `apps/web-app/src/features/pdf-export/lib/render-trip-pdf.ts` imports the same constant and prints it as a footer on the first PDF page via `pdf.text(PLANNING_DISCLAIMER, x, y, { maxWidth: 540 })` (jsPDF's text API). Placed inside the bottom margin (y = pageHeight − 24 pt). One source, two surfaces.

19. **Global synced clock in the top bar.** `apps/web-app/src/components/app-shell/app-clock.tsx` renders `HH:mm` formatted via `Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" })`. Mounts inside the `<header>` element of `AppShellLayout`, before the breadcrumb (or after, decided at implementation time after a UI sketch).
    - **Update cadence**: `setInterval(setNow, 30000)` — 30 s tick, with an initial `setTimeout` aligned to the next minute boundary so the displayed minute changes promptly. NOT one-second tick (battery + repaint cost; the clock displays minutes, not seconds).
    - Cleanup on unmount (clear the interval + the timeout).
    - Tooltip on hover: "Home-terminal time. The planner uses this TZ for all log-day boundaries." (Aligns with `docs/interstate-truck-driver-guide.md` "Time base to be used" line 176 — drivers use home-terminal time on the log sheets.)
    - When dark mode is active, prepend a tiny `Moon` lucide icon (`size-3 text-muted-foreground`) before the time. Pure visual nudge; no behavior change.
    - **Respects `prefers-reduced-motion`**: no animation on the tick (just a value swap). Already covered since we don't animate the change.

## Phase 11a — Resilience floor

Branch: `feat/11a-resilience-floor` off `develop`. PR `feat/11a-resilience-floor → develop`.

**New files (web-app):**

- `apps/web-app/src/components/error-boundary/app-error-boundary.tsx`
- `apps/web-app/src/components/error-boundary/route-error-element.tsx`
- `apps/web-app/src/components/error-boundary/feature-error-fallback.tsx`
- `apps/web-app/src/app/routes/not-found.tsx`
- `apps/web-app/src/config/strings.ts`

**New files (web-auth):**

- `apps/web-auth/src/components/error-boundary/app-error-boundary.tsx`
- `apps/web-auth/src/components/error-boundary/route-error-element.tsx`

**New files (packages/ui):**

- `packages/ui/src/lib/reportable-error.ts`
- `packages/ui/src/lib/reportable-error.test.ts`

**Modified files:**

- `apps/web-app/src/app/provider.tsx` — wrap `{children}` with `<AppErrorBoundary>` between `<QueryClientProvider>` and `<Suspense>`. Pass `<ThemeProvider storageKey={...}>` (see Phase 11b — defer the per-user key until then to keep 11a strictly resilience).
- `apps/web-app/src/app/router.tsx` — add `errorElement: <RouteErrorElement />` on the layout route + each child route; add `{ path: "*", element: <NotFoundRoute /> }` as the last child of the layout route.
- `apps/web-auth/src/app/provider.tsx` — wrap `{children}` with `<AppErrorBoundary>`; change `<Toaster />` at line 16 to `<Toaster position="bottom-right" richColors closeButton />`.
- `apps/web-auth/src/app/router.tsx` — add `errorElement: <RouteErrorElement />` on each route (the existing catch-all `<Navigate to="/sign-in" />` stays).
- `apps/web-app/src/app/routes/trips-detail.tsx` — wrap `<TripMap />` and `<DailyLogSheetsStrip />` each in `<FeatureErrorBoundary>` (the boundary's `onReset` calls `useQueryErrorResetBoundary().reset()` to refetch the underlying TanStack Query).
- `apps/web-app/src/features/trip-planner/api/plan-trip.ts` — switch `toast.error(...)` to `reportableError(...)`.
- `apps/web-app/src/features/saved-trips/api/delete-trip.ts` — same swap.
- `apps/web-app/src/features/exports/api/delete-export.ts` — same swap.
- `apps/web-app/src/features/exports/components/recreate-export-button.tsx` — same swap if applicable.
- `apps/web-app/package.json` — add `"react-error-boundary": "^6.1.1"`.
- `apps/web-auth/package.json` — add `"react-error-boundary": "^6.1.1"`.

**Tests (co-located, Vitest 4 + Testing Library):**

- `app-error-boundary.test.tsx` — renders fallback on a child that throws; `onReset` triggers re-render of children.
- `route-error-element.test.tsx` — for `useRouteError() = ErrorResponse{ status: 404 }` renders the 404 message; for a thrown `Error` renders the generic message.
- `feature-error-fallback.test.tsx` — renders inline `<Empty>`; "Reload this section" button click invokes the passed-in `resetErrorBoundary` callback.
- `not-found.test.tsx` — "Plan a trip" link points to `/trips/new`; "Saved trips" link to `/trips`.
- `reportable-error.test.ts` — toast is called with `error.message`; non-Error inputs fall back to "Something went wrong"; `console.error` always fires.

**Citations the spec must include:**

- Bulletproof React multi-layered error handling — `https://github.com/alan2207/bulletproof-react/blob/master/docs/error-handling.md`
- React Router v7 error boundary guide — `https://reactrouter.com/how-to/error-boundary`
- React Router v7 installed types — local file `node_modules/.pnpm/react-router@7.15.1.../dist/development/data-BqZ2x964.d.ts:788-793`
- `react-error-boundary` — `https://github.com/bvaughn/react-error-boundary` (v6.1.1 verified via `https://registry.npmjs.org/react-error-boundary/latest`)
- TanStack Query `useQueryErrorResetBoundary` — `https://tanstack.com/query/v5/docs/react/reference/QueryErrorResetBoundary`

## Phase 11b — UX polish

Branch: `feat/11b-ux-polish` off `develop` (rebased on top of `feat/11a-resilience-floor` after 11a merges). PR `feat/11b-ux-polish → develop`.

**New files (BE):**

- `apps/web-api/web_api/apps/geocoding/serializers.py` — add `GeocodeReverseRequestSerializer` (or extend the existing file if a single one exists).
- `apps/web-api/tests/geocoding/test_views_reverse.py` — view tests including ownership / throttle / happy path / ORS failure.
- `apps/web-api/tests/geocoding/test_client_reverse.py` — client tests with mocked `_session.get`.

**Modified files (BE):**

- `apps/web-api/web_api/integrations/openrouteservice.py` — add `_REVERSE_PATH`, `ReverseGeocodeResult` dataclass, `def reverse(...)`. Reuses `_session`, `_REQUEST_TIMEOUT_SECONDS`, `_BOUNDARY_COUNTRY`, the exception classes.
- `apps/web-api/web_api/apps/geocoding/views.py` — add `GeocodeReverseView(APIView)`.
- `apps/web-api/web_api/apps/geocoding/urls.py` — register `path("reverse/", GeocodeReverseView.as_view(), name="reverse")`.
- `apps/web-api/web_api/settings/base.py` — add `geocode_reverse: 30/min` to `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`.
- `apps/web-api/openapi.yaml` — regenerated via `uv run manage.py spectacular --color --file openapi.yaml`.
- `context/architecture.md` — append `geocode_reverse = 30/min` row to the "Rate limiting" table.

**New files (FE):**

- `apps/web-app/src/features/trip-planner/api/geocode-reverse.ts` — TanStack Query mutation hitting `/api/geocode/reverse/`.
- `apps/web-app/src/features/trip-planner/hooks/use-geolocation.ts`
- `apps/web-app/src/features/trip-planner/hooks/use-recent-locations.ts`
- `apps/web-app/src/features/trip-planner/components/use-current-location-button.tsx`
- `apps/web-app/src/features/trip-planner/components/recent-locations-group.tsx`
- `apps/web-app/src/features/trip-planner/components/assumptions-banner.tsx`
- `apps/web-app/src/features/trip-planner/components/planning-disclaimer.tsx`
- `apps/web-app/src/features/trip-planner/components/day-breakdown-accordion.tsx`
- `apps/web-app/src/features/trip-planner/components/why-this-stop-tooltip.tsx`
- `apps/web-app/src/features/pdf-export/components/pdf-preview.tsx`
- `apps/web-app/src/components/app-shell/app-clock.tsx`

**Modified files (FE):**

- `apps/web-app/src/features/trip-planner/components/address-field.tsx` — render `<UseCurrentLocationButton>` when `name === "current"`; consume `useRecentLocations()` and pass to `<AutocompleteBody>`; call `pushRecent(feature)` inside `handleSelect`.
- `apps/web-app/src/features/trip-planner/components/stops-list.tsx` — wrap each `StopRow` with `<WhyThisStopTooltip>`.
- `apps/web-app/src/features/trip-planner/components/trip-detail-panel.tsx` — mount `<DayBreakdownAccordion>` below the existing `<StopsList>` under a section heading.
- `apps/web-app/src/features/trip-planner/utils/stop-kind-labels.ts` — extend `STOP_KIND_META` with `reason` for `pickup`, `dropoff`, `fuel`.
- `apps/web-app/src/features/pdf-export/components/export-dialog.tsx` — mount `<PdfPreview>` above the existing `<ToggleGroup>`.
- `apps/web-app/src/features/pdf-export/lib/render-trip-pdf.ts` — call `pdf.text(PLANNING_DISCLAIMER, 36, pageHeight - 24, { maxWidth: 540 })` after the SVG is drawn on the first page.
- `apps/web-app/src/app/provider.tsx` — pass `storageKey={\`outbound-theme:${user?.id ?? "anonymous"}\`}`to`<ThemeProvider>`. Requires `useUser()`from Clerk; since`<ThemeProvider>`is currently outside`<ClerkProvider>`in the provider tree, the simplest fix is to introduce an inner`<ThemedAppShell>`component that consumes`useUser()`and re-renders the children inside a fresh`<ThemeProvider>`. Alternative: keep the storage key static and document the limitation. **First attempt: the wrap-trick. Second attempt: static key + docstring**. Decide at implementation time.
- `apps/web-app/src/components/app-shell/app-shell-layout.tsx` — mount `<AppClock>` in the `<header>`.
- `apps/web-app/src/app/routes/trips-detail.tsx` — mount `<AssumptionsBanner>` above the `<Tabs>` and `<PlanningDisclaimer>` below the day breakdown.
- `apps/web-app/src/config/strings.ts` — add `PLANNING_DISCLAIMER` + the 404 strings.
- `packages/ui/src/components/theme/theme-provider.tsx` — accept optional `storageKey?: string` prop (default `"outbound-theme"`).

**Tests:**

- `geocode-reverse.test.ts` — fetcher dispatches the right URL + body; success returns the feature; ORS 401/429/500 cases.
- `use-geolocation.test.ts` — mock `navigator.geolocation`: success, permission-denied, timeout, outside-US coords each surface the right status.
- `use-recent-locations.test.ts` — push/dedupe/cap-3 behavior; per-user key isolation; QuotaExceededError swallowed.
- `use-current-location-button.test.tsx` — click invokes the hook; loading state shows `Loader2`; failure routes through `reportableError`.
- `recent-locations-group.test.tsx` — renders Recent group when search is empty; falls back to the typing-prompt when no recents.
- `day-breakdown-accordion.test.tsx` — renders one collapsible per LogDay; per-day totals match the input fixture; expand reveals events.
- `assumptions-banner.test.tsx` — dismiss persists per-trip; re-mount with the same tripId stays dismissed; different tripId re-shows.
- `planning-disclaimer.test.tsx` — renders the canonical string.
- `pdf-preview.test.tsx` — Next/Prev paginate; "Page X of N" caption updates.
- `app-clock.test.tsx` — renders the formatted hour:minute string; interval cleared on unmount.
- `why-this-stop-tooltip.test.tsx` — for each `StopKind`, the tooltip body matches `STOP_KIND_META[kind].reason`.
- BE: `test_views_reverse.py` — ownership 401, throttle 429 after 31 calls, happy-path 200 with the Pelias feature shape.
- BE: `test_client_reverse.py` — happy path, 401, 429, 500, network error each map to the right exception.

**Citations the spec must include:**

- MDN `Geolocation.getCurrentPosition` — `https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition`
- ORS Pelias reverse — `https://openrouteservice.org/dev/#/api-docs/geocode/reverse/get` (verify exact param names at implementation time)
- Clerk `useUser` — `https://clerk.com/docs/references/react/use-user`
- jsPDF `pdf.text` — verify against installed `jspdf@4` types at implementation time

## Phase 11c — Accessibility pass

Branch: `feat/11c-a11y-pass` off `develop` (rebased on top of `feat/11b-ux-polish`). PR `feat/11c-a11y-pass → develop`.

**New files:**

- `apps/web-app/src/testing/axe.ts` — wires `jest-axe`'s `toHaveNoViolations` into Vitest's `expect.extend`.
- `apps/web-app/src/features/trip-planner/components/trip-input-form.a11y.test.tsx`
- `apps/web-app/src/app/routes/trips-detail.a11y.test.tsx`
- `apps/web-app/src/features/exports/components/exports-table.a11y.test.tsx`
- `apps/web-auth/src/testing/axe.ts` (same wiring)
- `apps/web-auth/src/app/routes/sign-in.a11y.test.tsx`

**Modified files:**

- `packages/eslint-config/react.js` — add `eslint-plugin-jsx-a11y` and apply its `flat/recommended` preset (the package supports flat config per its package.json `flat-esm` / `flat-cjs` example dirs). Run `pnpm exec turbo run lint --affected` once after the install and fix or document any new violations.
- `apps/web-app/src/testing/setup.ts` — import `./axe.ts` so the matcher is registered before each test file.
- `apps/web-auth/src/testing/setup.ts` — same.
- `apps/web-app/package.json` — add `"jest-axe": "^10.0.0"`, `"@types/jest-axe": "^3.5.9"`.
- `apps/web-auth/package.json` — same.
- `packages/eslint-config/package.json` — add `"eslint-plugin-jsx-a11y": "^6.10.2"`.

**Tests:**

- Three `.a11y.test.tsx` files asserting `expect(await axe(container)).toHaveNoViolations()`.
- One web-auth a11y test on the sign-in screen.

**Sub-agent audit (recorded inline at the bottom of this spec under "Accessibility audit"):**

- `accessibility-compliance:ui-visual-validator` invoked on each of:
  - `/` (web-app — redirects, but capture the post-redirect screen)
  - `/trips/new`
  - `/trips/:id` (with a planned trip)
  - `/trips` (with saved trips)
  - `/exports`
  - `/sign-in` (web-auth)
  - `/sign-up` (web-auth)
  - `/forgot-password` (web-auth)
- Findings tabled below; severity (high / medium / low); remediation; commit SHA where fixed.

**Citations the spec must include:**

- `eslint-plugin-jsx-a11y@6.10.2` — `https://github.com/jsx-eslint/eslint-plugin-jsx-a11y` (latest verified via `https://registry.npmjs.org/eslint-plugin-jsx-a11y/latest`)
- `jest-axe@10.0.0` — `https://github.com/nickcolley/jest-axe` (latest verified via `https://registry.npmjs.org/jest-axe/latest`). Works with Vitest 4 via `expect.extend(toHaveNoViolations)`; cite the integration pattern in the matcher setup file.
- WCAG 2.2 — `https://www.w3.org/TR/WCAG22/`
- APCA contrast (already documented in `context/ui-context.md`)

## Implementation sequencing

1. **Phase 11a — Resilience floor.** ~2 days. The four error-boundary surfaces + 404 page + Toaster sync + `reportableError`. Self-contained; no BE work; the diff is bounded.
2. **Phase 11b — UX polish.** ~4 days. Split internally: (i) BE reverse-geocode endpoint + tests, (ii) FE geolocation + recent-locations + per-user theme + clock, (iii) FE day breakdown + PDF preview + tooltips + assumptions banner + disclaimer.
3. **Phase 11c — A11y pass.** ~1.5 days. ESLint plugin install + lint-fix pass + jest-axe wiring + 3 a11y tests + the sub-agent audit + any remediations.

Total ~7.5 working days. Each phase ends with `code-reviewer` invoked on the diff; `architect-review` invoked on 11a (boundary topology) and 11b (BE endpoint surface); `security-auditor` invoked on 11b (new BE route, lat/lon validation, throttle bucket); `accessibility-compliance:ui-visual-validator` invoked at the end of 11c.

## Verification checklist (per-phase)

### Phase 11a

- [ ] `react-error-boundary@6.1.1` installed in both `apps/web-app` and `apps/web-auth`.
- [ ] Synthetic error thrown inside `<TripMap />` → `<FeatureErrorBoundary>` catches; inline `<Empty>` renders; "Reload this section" refetches the failing TanStack Query.
- [ ] Synthetic error thrown inside `<DailyLogSheetsStrip />` → same behavior.
- [ ] Synthetic error thrown at a route element (e.g., in `<TripsHistoryRoute />`) → `<RouteErrorElement />` catches; sidebar stays visible; "Reload" rerenders the route.
- [ ] Synthetic error thrown at the app shell layer → `<AppErrorBoundary>` catches; full-page on-brand fallback; "Return home" navigates to `/trips/new`.
- [ ] `https://app.dev/no-such-route` → 404 page inside `AppShellLayout`; sidebar visible; "Plan a trip" + "Saved trips" CTAs functional.
- [ ] `https://auth.dev/no-such-route` → still redirects to `/sign-in` (unchanged behavior).
- [ ] web-auth Toaster renders `richColors closeButton position="bottom-right"` (matches web-app).
- [ ] Every existing mutation `onError` callback uses `reportableError(...)`.
- [ ] No `Co-Authored-By` trailer; no `--no-verify`; Conventional Commits subject.
- [ ] `pnpm exec turbo run lint typecheck test build --affected` clean.

### Phase 11b

- [ ] `GET /api/geocode/reverse/?lat=&lon=` returns the Pelias feature shape with `Authorization` header (Clerk JWT).
- [ ] Reverse-geocode endpoint enforces `geocode_reverse = 30/min` per-user throttle.
- [ ] OpenAPI schema regenerated; `apps/web-api/openapi.yaml` diff limited to the new path.
- [ ] `context/architecture.md` "Rate limiting" table updated.
- [ ] Click "Use my current location" with permission allowed → field populates with the reverse-geocoded address.
- [ ] Permission denied / timeout / position-unavailable → toast surfaces a graceful message; field stays empty.
- [ ] DevTools sensors spoofing coords outside the US (e.g., lat=51, lon=-1 for London) → toast "Outside the US — please type an address manually."; field stays empty.
- [ ] After picking 3 addresses, sign out, sign in as a different Clerk user → user B sees no recents (per-user namespace works).
- [ ] After picking 3 addresses, sign out, sign in as the same user → recents restore.
- [ ] A multi-day trip's `<DayBreakdownAccordion>` lists one collapsible per LogDay; per-day totals match the LogDay rollups; expanded body lists the LogEvents in chronological order.
- [ ] `ExportDialog` opens with a preview of page 1; Next/Prev paginate; selected mode swaps the preview between multi/single-page rendering; clicking Download produces a PDF whose first page matches the preview AND contains the disclaimer footer.
- [ ] Hovering / focusing any stop in `StopsList` reveals the §395 reason (or assignment-brief assumption for pickup/dropoff/fuel).
- [ ] `AssumptionsBanner` shows on a fresh `/trips/:id`; dismissal persists for that trip ID; opening another trip re-shows.
- [ ] `<PlanningDisclaimer>` renders at the bottom of the trip-detail page in `text-muted-foreground text-xs`.
- [ ] Top-bar clock updates within 30 s of minute roll-over; tooltip explains home-terminal TZ.
- [ ] Dark-mode toggle persists per Clerk user via `outbound-theme:${userId}` localStorage key.
- [ ] `pnpm exec turbo run lint typecheck test build --affected` clean.
- [ ] `cd apps/web-api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest` clean.

### Phase 11c

- [ ] `eslint-plugin-jsx-a11y@6.10.2` installed in `packages/eslint-config`; `flat/recommended` preset active.
- [ ] `pnpm exec turbo run lint --affected` clean (any `jsx-a11y` violations either fixed or `eslint-disable`d with a one-line WHY).
- [ ] `jest-axe@10.0.0` installed in both apps; matcher registered.
- [ ] Three `.a11y.test.tsx` files in `web-app` (trip form, trip detail, exports table) + one in `web-auth` (sign-in) all pass.
- [ ] `accessibility-compliance:ui-visual-validator` invoked on all eight surfaces; findings captured in the "Accessibility audit" table.
- [ ] All high-severity findings remediated in the same branch; medium / low documented with a follow-up issue link.
- [ ] `prefers-reduced-motion: reduce` (Chrome DevTools → Rendering tab) → all new components render without animation.
- [ ] WCAG 2.5.8 target-size check: every new interactive element ≥ 24 × 24 CSS px (default shadcn sizes clear this; verify the icon-ghost "Use current location" button).
- [ ] `pnpm exec turbo run lint typecheck test build --affected` clean.

## Sub-agent reviews (mandatory)

- `code-reviewer` (from `comprehensive-review`) on every phase branch's diff before merge.
- `architect-review` on **11a** (boundary topology — is the layered placement correct?) and **11b** (the BE endpoint addition — does the one-system-boundary rule still hold?).
- `security-auditor` on **11b** (lat/lon validation; throttle bucket; ownership of the reverse endpoint).
- `accessibility-compliance:ui-visual-validator` on **11c** end-to-end — findings in the audit table below.
- `application-performance:performance-optimizer` on **11b** (cost of the day-by-day collapsible mounting; cost of the PDF preview's SVG cloning).
- `javascript-typescript:typescript-pro` on **11b** (React 19 idioms — should `useGeolocation` be a `useActionState`? Should `useRecentLocations` use `useSyncExternalStore`?).

## Accessibility audit (Phase 11c — to be populated)

| Surface            | Tooling               | Finding | Severity | Remediation | Commit |
| ------------------ | --------------------- | ------- | -------- | ----------- | ------ |
| `/trips/new`       | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |
| `/trips/:id`       | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |
| `/trips`           | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |
| `/exports`         | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |
| `/sign-in`         | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |
| `/sign-up`         | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |
| `/forgot-password` | `ui-visual-validator` | TBD     | TBD      | TBD         | TBD    |

(Filled in during 11c implementation.)

## Out of scope (deliberate)

- **Sentry / external error reporting wiring.** `reportableError()` exposes the hook; production wiring lands in a deployment-unit spec.
- **BE-side recent-locations or theme persistence.** `localStorage` is enough for the assessment review; multi-device sync is a future concern.
- **Custom multi-page PDF preview navigator with thumbnails.** Single-page preview + Next/Prev is enough.
- **Refactoring `stop-kind-labels.ts` table shape.** Extend only.
- **Real ELD / device integration.** Explicit v1 exclusion per `context/project-overview.md#Scope`.
- **60-hour / 7-day schedule, hazmat, adverse-conditions extensions, team-driver / sleeper-berth pairing.** Explicit v1 exclusions.
- **Custom font embedding into jsPDF.** Spec 10 decision 4 deferred this; spec 11 inherits the deferral.
- **A11y findings of medium / low severity that surface during the audit** — these get a follow-up issue link, not a same-spec fix, to keep the phase scope bounded.

## Open questions

1. **Wrap-trick for per-user theme key vs. static key.** Per Decision 13, the cleanest implementation requires `useUser()` inside the provider tree, which means restructuring `provider.tsx`. If the restructure is fiddlier than expected (e.g., introduces a flicker on sign-in), fall back to a static key + a one-line decision-of-record note in `progress-tracker.md`. First attempt: wrap-trick. Second attempt: static key.
2. **Day-by-day breakdown — tabs vs. side-by-side vs. below-stops.** Decision 14 leans "below `StopsList`". Final placement decided at implementation time after a UI sketch with `ui-visual-validator` feedback. Whichever placement chosen, the verification checklist above stays valid.
3. **PDF preview scale.** The 240×320 target in Decision 15 is a starting estimate; final size tuned at implementation time so the preview reads legibly without forcing dialog scroll on a 14" laptop.

## Anti-drift checks (enforced at PR review)

- No hex literals in any new component.
- No `bg-blue-*` style raw colors.
- No manual `dark:` color overrides.
- No `space-x-*` / `space-y-*` — `gap-*` only.
- No cross-feature imports.
- No new sub-agents under `.claude/agents/`.
- No `useEffect` for data fetching.
- No `Co-Authored-By` trailer; no `--no-verify`.
- HOS planner (`web_api/hos/`) untouched — `apps/web-api/tests/hos/test_boundary.py` passes verbatim.
- `apps/web-api/openapi.yaml` regenerated, not hand-edited.
- Migrations: none in this spec (no model changes).
- All new third-party version pins are citation-backed (registry JSON or installed source).
