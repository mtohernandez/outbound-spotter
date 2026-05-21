# 07 — Leaflet map renderer

> Replace the centered `RouteSummary` placeholder on `/trips/:id` with an interactive Leaflet map that draws the ORS polyline + color-coded `TripStop` markers (pickup, dropoff, fuel, break, sleeper, restart) sourced from `GET /api/trips/<id>/plan/`. Brand-themed (theme tokens only, no hex), fit-to-route on first mount, code-split via Vite `manualChunks` so non-trip routes stay slim, accessible via keyboard. The existing `RouteSummary` `<dl>` collapses into the `TripDetailPanel`'s Route `SidebarGroup` as a denser display — the main area becomes pure map, the side panel becomes the chrome. No client-side HOS math — invariant #4 from `context/architecture.md` is the load-bearing rule; the FE consumes the spec-06 persisted plan and renders it.

## Goal

Land the map output the assessment grades against. After this spec ships, a signed-in driver who plans a trip lands on `/trips/:id` and sees: (1) a Leaflet map filling the main area, route polyline drawn in brand teal, color-coded markers for every stop the HOS planner emitted, popups with the stop type / scheduled time / location / duration on click; (2) the `TripDetailPanel` Route `SidebarGroup` now showing total distance + total duration + per-leg breakdown + the "Departs at …" line from spec 06 — denser, dual-panel, dead simple. The §395.8 SVG log-sheet renderer (spec 08) and the PDF export (spec 09) consume the same `/api/trips/<id>/plan/` payload; this spec is the visual half of "Map showing route and information regarding stops and rests" (`docs/assesment.md` line 13).

Five user-visible additions:

1. **Interactive Leaflet map** at the main area of `/trips/:id`. OSM standard tiles. Pan, zoom, tile-loaded. Fit-to-route auto-zoom on first mount (with 48 px padding so the markers don't sit under the side panels). No auto-recenter on later interactions; an optional "Recenter" affordance bound to the `R` key restores the initial fit.
2. **Route polyline** drawn as a single styled path in `var(--teal-600)`, 4 px stroke weight, 0.85 opacity. Lat/lon order swapped from ORS's `[lon, lat]` to Leaflet's `[lat, lon]` convention at the schema layer.
3. **Color-coded stop markers** for every `TripStop` from the spec-06 plan. Six kinds × six theme-token colors (mapped centrally in `stop-type-colors.ts`). Each marker is a brand-themed `L.divIcon` rendering an inline `<svg>` colored by a CSS variable — no PNG sprites, no hex literals.
4. **Marker popups** show the stop kind chip, the scheduled time (`Intl.DateTimeFormat` in `America/New_York`), the location label or lat/lon string, and the duration. Popup chrome is shadcn-themed via a global CSS override that defers to `--popover` / `--popover-foreground` / `--border` / `--radius-lg` tokens.
5. **`TripDetailPanel` Route group expansion.** The current `RouteSummary` `<Card>` from spec 04 is repurposed into a `SidebarGroup` inside `TripDetailPanel`. The `<dl>` rows move into the panel; the main area frees up entirely for the map. The "Departs at" line from spec 06 sits in the same SidebarGroup. No duplicate titles, no per-leg cards — same density anchor as spec 04.

Architecture invariants from `context/architecture.md` hold: #1 (HOS planner pure — this spec is FE-only and never touches `web_api/hos/**`), #4 (no client-side HOS math — the FE consumes persisted `TripStop` / `LogEvent` rows from spec 06's `/api/trips/<id>/plan/` and renders them), #5 (ownership-gated — the plan endpoint already enforces it; the FE only requests trips the signed-in driver owns), #7 (theme tokens only — every marker color comes from `--teal-*` / `--red-*` CSS variables; no hex in `marker-icons.tsx`), #8 (no custom sub-agents), #9 (specs drive implementation).

## Decisions of record (resolved at planning time)

Pre-resolved during the spec-05/06/07 planning session. Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-temporal-coral.md`.

1. **`react-leaflet@5.x` + `leaflet@1.9.4` + `@types/leaflet`.** Pinned per `context/architecture.md#Stack`. Leaflet 2 is still alpha at write time; `react-leaflet@5` is the current stable line that supports React 19. Versions are verified at PR-write time via `npm view react-leaflet version` / `npm view leaflet version` and recorded in the PR body. The architecture.md stack table already lists the pins; this spec ships against them without re-deciding.

2. **OpenStreetMap standard tiles** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) with mandatory attribution. `TileLayer.attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'` per the OSM tile-usage policy (<https://operations.osmfoundation.org/policies/tiles/>). No custom tile server, no MapTiler / Mapbox token, no Carto basemap. v1 stays on the free OSM tiles. The policy requires a "valid HTTP User-Agent identifying the application" — Leaflet handles this via the browser default. Heavy users are asked to set up a tile cache or commercial provider; the assessment review window is short enough that v1 doesn't need to.

   **Tile-fetch pattern is user-interaction-bounded.** v1 issues tile fetches only in response to user pan / zoom (Leaflet's default behavior). No programmatic preloading, no SSR tile mirroring, no map-tile prefetch on route hover. A future tile-cache or commercial-provider migration is queued separately and must explicitly re-evaluate the User-Agent requirement at that time (pre-implementation architect-review finding m7).

3. **Brand markers via `L.divIcon` with inline SVG colored via CSS class names** (NOT inline `style="color:..."`). Each marker kind has a small inline `<svg fill="currentColor">` (~150 bytes per marker) wrapped in a `<span class="trip-marker__icon trip-marker__icon--{kind}">` where the per-kind class sets `color: var(--teal-500)` (or the matching ramp variable). The CSS class rules live in `packages/ui/src/styles/globals.css` alongside the popup-theming block (decision 8). Result: every marker color comes from the theme tokens — invariant #7 trivially upheld AND zero inline styles ship, which retires the CSP-compatibility open question pre-implementation architect-review caught (finding m4). Trade-off vs. PNG sprites: SVG markers add ~1 KB total (vs. a ~5 KB sprite atlas + the HTTP round-trip), zero filesystem assets, full theme-token compliance, CSP-safe. The Leaflet default blue marker pin is NOT shipped; the `_initIcon` override stripping the default is in `trip-map.tsx`'s mount-time setup.

4. **Stop-kind → CSS class mapping centralized in `stop-type-colors.ts`.** The TS module exports both the class-name lookup (used by `marker-icons.tsx`) and the underlying token map (used in tests for documentation / drift detection):

   ```ts
   import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

   // The CSS class set in packages/ui/src/styles/globals.css — see decision 8.
   export const STOP_TYPE_CLASSNAMES: Record<StopKind, string> = {
     pickup: "trip-marker__icon--pickup",
     dropoff: "trip-marker__icon--dropoff",
     fuel: "trip-marker__icon--fuel",
     break: "trip-marker__icon--break",
     sleeper: "trip-marker__icon--sleeper",
     restart: "trip-marker__icon--restart",
   };

   // Documents the intended color token per kind. Test asserts the matching CSS
   // rule resolves to this variable (via fixture stylesheet inspection).
   export const STOP_TYPE_TOKENS: Record<StopKind, string> = {
     pickup: "--teal-500",
     dropoff: "--red-500",
     fuel: "--teal-300",
     break: "--teal-400",
     sleeper: "--teal-700",
     restart: "--teal-800",
   };
   ```

   Pickup uses the bright teal (active brand color, where the load is acquired). Dropoff is the lone red — the trip's terminus + the brand's only destructive token, reserved for "end of state." Fuel is the lightest teal (subtle, repeated stop). Break is mid-teal (planner-inserted, regulatory). Sleeper is dark teal (long pause). Restart is darkest teal (rare, 34h). No greens / oranges / arbitrary brand-foreign hues — the palette stays anchored on the `--teal-*` ramp + the lone `--red-500` per `context/ui-context.md`.

5. **Vite `manualChunks` splits `leaflet` + `react-leaflet` (+ `@react-leaflet/core`) into a separate chunk.** Target: the leaflet bundle (~140 KB minified, ~45 KB gzip) lands in `leaflet-vendor-<hash>.js`, NOT in the main entry chunk. Entry chunk size delta vs. spec 06 must be ≤ +5 KB (small overhead from the `React.lazy` boundary). `apps/web-app/vite.config.ts` adds:

   ```ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           "leaflet-vendor": ["leaflet", "react-leaflet", "@react-leaflet/core"],
         },
       },
     },
   }
   ```

   **`@react-leaflet/core` is mandatory in the carve-out** — `react-leaflet@5` splits into `react-leaflet` (component layer) + `@react-leaflet/core` (imperative bridge); without the core package in the manualChunks list, Rollup either drops it into the entry chunk or creates a third chunk that defeats the ≤+5 KB target. (Pre-implementation architect-review finding m2.) Verify the resolved package name at install time via `pnpm why @react-leaflet/core`; if v5.x renames or restructures, adjust the manualChunks list and record the resolution in the PR body.

   Closes the `perf/<NN>-bundle-split` follow-up tracked in `context/progress-tracker.md#Next Up`. This is the spec's lone Vite-config touch.

6. **`<TripMap />` is `React.lazy`-loaded** inside `TripsDetailRoute`. The user lands on `/trips/:id`, sees the side-panel render immediately (which already has the route summary + departs line from spec 06's `TripResponse`), then the map area shows a `<SpotterLoader />` while the leaflet-vendor chunk loads, then the map appears. The lazy import is `const TripMap = lazy(() => import("@/features/trip-planner/components/trip-map"));`. The map module imports `leaflet` + `react-leaflet` — these go into the lazy-loaded chunk via the manualChunks rule above. Without lazy + manualChunks, the main entry chunk would balloon.

7. **Fit-to-route fires ONCE per non-empty mount.** A small hook component `<FitToRoute polyline={…} />` lives inside the `<MapContainer>` (sibling to `<TileLayer>` / `<Polyline>` / markers), uses `useMap()` to get the imperative Leaflet handle, computes `L.latLngBounds(polyline)`, calls `map.fitBounds(bounds, { padding: [48, 48] })` exactly once when positions transition from empty → non-empty. Effect dep array is `[map, hasPositions]` where `hasPositions = positions.length > 0` — NOT `[map]` only, which would silently skip the fit if a future spec ever introduces data-arrives-later semantics (pre-implementation architect-review finding M1). 48 px padding because the side-panel sits at the right edge on desktop; on mobile the side-panel slides under and 48 px keeps markers off-screen-edge anyway.

   **NO auto-recenter on later interactions.** Dragging, zooming, or selecting markers must NOT trigger another `fitBounds`. The "Recenter" affordance binds the `R` keystroke (the map is `tabIndex={0}` for keyboard reachability) to call the same fit-to-route routine again — but only when the map has focus.

8. **Marker popups are shadcn-themed via a global CSS override.** Leaflet's default popup chrome has hard-coded box-shadow + arrow + close-button styling. Overriding `className: "leaflet-popup-themed"` plus a single CSS rule block in `packages/ui/src/styles/globals.css` re-themes them:

   ```css
   .leaflet-popup-themed .leaflet-popup-content-wrapper {
     background: var(--popover);
     color: var(--popover-foreground);
     border: 1px solid var(--border);
     border-radius: var(--radius-lg);
     box-shadow: var(--shadow-md);
   }
   .leaflet-popup-themed .leaflet-popup-tip {
     background: var(--popover);
     border: 1px solid var(--border);
   }
   .leaflet-popup-themed .leaflet-popup-close-button {
     color: var(--muted-foreground);
   }
   ```

   This is the ONLY change to `packages/ui/src/styles/globals.css` — no token additions, no `@theme inline` edits. The CSS rule lives next to existing third-party-component overrides (if any; otherwise at the bottom of the file, with a comment citing this spec). `dark:` overrides are NOT needed — the tokens already swap dark / light.

9. **TanStack Query hook `useTripPlan(tripId)` keyed `["trip", tripId, "plan"]`.** `staleTime: 5 * 60_000` (5 min — the plan is immutable per spec 06; aggressive caching is correct). `refetchOnWindowFocus: false` (no point — plan doesn't change). `retry: false` (4xx is deterministic — 404 means missing, 401 means signed out; retrying burns the throttle from spec 06 decision 10). Lives in `apps/web-app/src/features/trip-planner/api/trip-plan.ts`. The hook parses the response via the spec-07 zod schema (`tripPlanSchema` in `schemas/trip-plan.ts`); a parse failure throws an `ApiError` with `body.detail = "Plan response shape unexpected"`. The hook is what spec 06 deferred (per spec 06 decision 15).

10. **`tripPlanSchema` (zod) mirrors spec 06's `TripPlanSerializer` envelope.** Decimal fields come through as strings (DRF default for `DecimalField`); the FE parses them with `z.coerce.number()` ONLY at the schema layer, never in components. Timestamps are ISO 8601 with offset (`z.string().datetime({ offset: true })`). Discriminated unions on `kind` for `TripStop` and on `status` for `LogEvent` are NOT used in spec 07 (the FE renders by stop kind via the central color map; events are not rendered in spec 07 — they're spec 08's concern). All four field arrays (`stops`, `events`, `days`) are typed but only `stops` is consumed by the map; `events` and `days` are exported types for spec 08.

11. **`RouteSummary` component is REPURPOSED, not deleted; caller owns the group label.** The existing spec-04 `RouteSummary` (`apps/web-app/src/features/trip-planner/components/route-summary.tsx`) currently renders a centered `<Card>` with the route `<dl>`. Spec 07 changes its render mode to "panel" — drops the `<Card>` wrapper, drops the centered layout, returns the `<dl>` body directly so it can mount inside a `SidebarGroup`. **Component stays presentational; the `TripDetailPanel` caller renders the `<SidebarGroupLabel>Route</SidebarGroupLabel>`.** The earlier draft floated a `withGroupLabel` prop — that is REJECTED (pre-implementation architect-review finding m9); the caller-owned label is the cleaner shape and matches the existing pattern for other SidebarGroups in `TripDetailPanel`. Component signature stays the same (`function RouteSummary({ trip }: { trip: TripResponse })`); only the JSX changes. The test (`route-summary.test.tsx`) updates the assertion target accordingly. The `TripsDetailRoute` no longer renders `<RouteSummary />` directly — it renders `<TripMap />`. The `TripDetailPanel` mounts `<RouteSummary />` inside its Route `SidebarGroup`.

12. **NO new shadcn primitives.** `SidebarGroup`, `SidebarGroupContent`, `SidebarGroupLabel`, `Badge`, `Skeleton`, `Empty` (for the failed-plan branch) — all installed. Spec 07 adds zero `pnpx shadcn@latest add` invocations.

13. **`leaflet/dist/leaflet.css` is imported at the entry of `trip-map.tsx`** (the lazy-loaded module), NOT at the global `app/main.tsx`. This keeps the leaflet CSS in the lazy chunk too; non-`/trips/:id` routes don't ship the ~14 KB leaflet stylesheet. The import is `import "leaflet/dist/leaflet.css";` at the top of `trip-map.tsx`. Vite's CSS-as-side-effect rule handles the inclusion in the lazy chunk.

14. **No reverse-geocoding labels on stops in v1.** `TripStop.label` is empty per spec 06. The popup displays `"40.7128, -74.0060"`-style coordinates as the location. A future spec adds Pelias reverse geocoding to populate `label` server-side; spec 07 reads `stop.label || formatLatLon(stop.lat, stop.lon)` so the upgrade is transparent. The formatter `formatLatLon(lat, lon) -> string` is a 4-line pure function in `utils/format-lat-lon.ts`.

15. **Keyboard a11y floor — `tabIndex={0}` + explicit marker keyboard prop, NO `role="application"`.** `<MapContainer tabIndex={0}>` (Leaflet handles arrow-key panning when focused). Each `<Marker>` ships with `keyboard={true}` explicitly (NOT relying on the Leaflet 1.9.4 default — pre-implementation architect-review finding m6 — so a future Leaflet major doesn't silently break keyboard reachability). Popups open on Enter / Space. The "Recenter" affordance binds `R` (only when the map has focus). `aria-label` on the map container reads "Trip route map. Use arrow keys to pan, plus and minus to zoom, R to recenter, Tab to step through stops."

    **`role="application"` is NOT used** in v1 (pre-implementation architect-review finding m5). The intent of `role="application"` is to disable the screen reader's virtual cursor so arrow keys reach the map — but it also silos popup content from AT readers unless every popup is hand-rolled with `role="dialog"`. v1 trades arrow-key SR panning for popup readability: a screen reader user can Tab through markers and read popups via the SR's default behavior. Pan/zoom is mouse / touch / `R`-keystroke dominant. The `aria-label` on the map container still names the widget; SR users get the map's purpose without losing access to the popup details. Future spec can revisit if a "spatial pan" use-case from a real driver surfaces.

16. **NO map without a plan; trip-vs-plan errors render distinct copy.** If either `useTripById(tripId)` or `useTripPlan(tripId)` is loading, render `<SpotterLoader size="lg" />` filling the main area. Error branching distinguishes the two failures (pre-implementation architect-review finding m1):
    - `trip.isError` → the Trip itself is missing or foreign-owned. Render `<Empty>` with `<EmptyTitle>Trip not found.</EmptyTitle>` + `<EmptyDescription>This trip may have been deleted. <Link to="/trips/new">Plan a new trip</Link>.</EmptyDescription>` — same shape as spec 04's FAILED state.
    - `plan.isError` → the Trip exists but the plan rows are missing. Under spec-06's atomic contract this cannot happen for a Trip created post-spec-06 — so if it does, it's a data-integrity event, not a UX error. Render `<Empty>` with `<EmptyTitle>Trip data missing.</EmptyTitle>` + `<EmptyDescription>The plan for this trip didn't load. Try again, or contact support if this persists.</EmptyDescription>` — different copy, no "plan a new trip" link (the trip is salvageable; a new one is the wrong action).

    If both succeed, render `<TripMap trip={trip.data} plan={plan.data} />`. No half-states; no map with empty markers.

17. **`/trips/:id` route handle stays single-Secondary.** The spec-03 `RouteHandle.Secondary` pattern (per `app-shell-layout.tsx`) renders `TripDetailPanel` as the second sidebar. Spec 07 changes nothing about the route handle — only the main `element` (was `TripsDetailRoute` rendering `<RouteSummary />`, now `TripsDetailRoute` rendering `<TripMap />`).

## Decisions amended post-implementation

Filled in if/when live-test surfaces a behavior the spec did not anticipate. Empty at write time.

## Scope

### In

**`apps/web-app` — deps + Vite config + map composition + repurposed summary + global CSS:**

- `apps/web-app/package.json` — add `leaflet@^1.9.4`, `react-leaflet@^5`, `@types/leaflet@^1.9` (`devDependencies` for the types). Pin majors; versions verified at PR-write time via `npm view`.
- `apps/web-app/vite.config.ts` — `build.rollupOptions.output.manualChunks` carve-out for `leaflet` + `react-leaflet` (decision 5).
- `features/trip-planner/api/trip-plan.ts` (NEW) — `useTripPlan(tripId)` TanStack Query hook (decision 9).
- `features/trip-planner/schemas/trip-plan.ts` (NEW) — `tripPlanSchema`, `tripStopSchema`, `logEventSchema`, `logDaySchema` zod types; exported types `TripPlan`, `TripStop`, `LogEvent`, `LogDay`, `StopKind`, `DutyStatus` (FE-side mirrors of the BE enums; FE-side these are just string-literal unions).
- `features/trip-planner/components/trip-map.tsx` (NEW) — the composition root. `React.lazy`-loaded. Imports `leaflet/dist/leaflet.css`. Renders `<MapContainer>` + `<TileLayer>` + `<RoutePolyline>` + `<StopMarker />` (mapped over `stops`) + `<FitToRoute>` + the keyboard `R` listener.
- `features/trip-planner/components/map/stop-type-colors.ts` (NEW) — exports `STOP_TYPE_CLASSNAMES` (class lookup) + `STOP_TYPE_TOKENS` (documentation map, used by tests for drift detection). See decision 4.
- `features/trip-planner/components/map/marker-icons.tsx` (NEW) — `buildMarkerIcon(kind: StopKind): L.DivIcon`. Returns a Leaflet DivIcon with inline SVG; color cascades from the per-kind `.trip-marker__icon--{kind}` class set in `globals.css`. NO inline `style` attribute on the HTML output (CSP-safe; per architect-review m4).
- `features/trip-planner/components/map/route-polyline.tsx` (NEW) — wraps `<Polyline>`; swaps `[lon, lat]` ORS pairs to `[lat, lon]` Leaflet `L.LatLng` pairs.
- `features/trip-planner/components/map/stop-marker.tsx` (NEW) — wraps `<Marker keyboard>` + `<Popup>`. Reads the icon from `marker-icons`; renders the popup body via `<MarkerPopup>`.
- `features/trip-planner/components/map/marker-popup.tsx` (NEW) — popup content: stop-kind chip (shadcn `Badge` with the matching per-kind class — `<Badge className={STOP_TYPE_CLASSNAMES[kind]}>` — NOT an inline `style`), scheduled time, location string (or `formatLatLon`), duration via `format-duration`. The same per-kind class drives both the marker color and the popup chip border (the `.trip-marker__icon--{kind}` rule uses `color`, which cascades to the chip's `border-color: currentColor` if we apply a small additional `[class*="trip-marker__icon--"] { border-color: currentColor; }` selector — OR a separate `.trip-badge--{kind}` class with `border-color: var(...)`. Pick one in implementation; the simpler `currentColor` cascade is the recommendation since it keeps the per-kind CSS to one declaration each.).
- `features/trip-planner/components/map/fit-to-route.tsx` (NEW) — the `useMap()` hook component (decision 7).
- `features/trip-planner/components/route-summary.tsx` — MODIFY: drop the `<Card>` wrapper; return the `<dl>` body directly. The "Route" group label is rendered by the caller (`TripDetailPanel`) via `<SidebarGroupLabel>`. The component itself stays presentational — NO `withGroupLabel` prop (per decision 11; architect-review m9 explicitly rejected that shape).
- `features/trip-planner/utils/format-lat-lon.ts` (NEW) — `formatLatLon(lat: number | string, lon: number | string): string` (returns `"40.7128, -74.0060"` with 4 decimal places; coerces string inputs from the Decimal fields).
- `features/trip-planner/utils/keyboard.ts` (NEW) — `isModifierKey(event: KeyboardEvent): boolean` helper (excludes Ctrl/Meta/Alt-prefixed presses from the `R` recenter handler so browser shortcuts don't trip the action).
- `components/app-shell/trip-detail-panel.tsx` — MODIFY: mount `<RouteSummary />` inside the Route `SidebarGroup`. The "Departs" line from spec 06 sits adjacent (same SidebarGroup; one `<dl>` containing both the route metrics and the departs line, or two adjacent `<dl>`s — pick one in implementation; the spec recommends one `<dl>` with the existing per-leg `<dt>`/`<dd>` rows + the "Departs" row at the bottom, no `<Separator />`).
- `app/routes/trips-detail.tsx` — MODIFY: replace the centered `<RouteSummary />` with branched rendering on `useTripById` + `useTripPlan` per decision 16 (distinct `<Empty>` copy for trip-404 vs plan-404), wrapped in `<Suspense fallback={<SpotterLoader size="lg" />}>` for the lazy `<TripMap />` import. No `<ErrorBoundary>` in v1 — TanStack Query's `isError` branches handle network/4xx errors; route-level errors fall through to React Router's default error boundary.
- `packages/ui/src/styles/globals.css` — MODIFY: add the `.leaflet-popup-themed` CSS rule block (decision 8). Single insertion at the bottom of the file; no token additions.

**`apps/web-app/src/testing/handlers.ts` — MSW plan handler:**

- Add `mockTripPlan(tripId, overrides?)`: returns an `http.get` handler for `/api/trips/:id/plan/` emitting a canned plan envelope matching `tripPlanSchema`. The default payload is the spec-05 `assessment_simple` golden translated into wire format (~5 events, 2 stops, 1 day). Exported.
- Existing `mockTripPlanned` extended only to ensure spec-06's `start_at` round-trip still passes alongside the new plan handler.

**Tests (mandatory minimum):**

- `apps/web-app/src/features/trip-planner/api/trip-plan.test.ts` (NEW) — `useTripPlan` happy-path against the MSW handler; 404 surfaces as `ApiError`; zod parse failure surfaces as `ApiError`; `retry: false` and `staleTime: 5*60_000` honored.
- `apps/web-app/src/features/trip-planner/schemas/trip-plan.test.ts` (NEW) — zod shape parses a valid envelope; rejects naive datetimes; rejects unknown `kind` values.
- `apps/web-app/src/features/trip-planner/components/map/marker-icons.test.tsx` (NEW) — for each `StopKind`, `buildMarkerIcon(kind)` returns a `L.DivIcon` whose `options.html` contains `class="trip-marker__icon trip-marker__icon--{kind}"` exactly (no inline `style` attribute, no hex token). Assertion shape: `expect(icon.options.html).toContain(STOP_TYPE_CLASSNAMES[kind])` AND `expect(icon.options.html).not.toMatch(/style="[^"]*color/)` AND `expect(icon.options.html).not.toMatch(/#[0-9a-fA-F]{3,8}/)`. (Pre-implementation architect-review finding M2: do NOT use `getComputedStyle` — jsdom does not resolve CSS custom properties, so a computed-style check returns the literal `var(--teal-500)` string rather than a resolved RGB; the raw HTML check is what mechanically proves invariant #7.) A separate fixture-stylesheet inspection test asserts the six `.trip-marker__icon--{kind}` CSS rules' `color` declaration matches the token in `STOP_TYPE_TOKENS` — preventing token-vs-class drift.
- `apps/web-app/src/features/trip-planner/components/map/stop-marker.test.tsx` (NEW) — renders a marker at the right `[lat, lon]`; popup shows kind, scheduled time, location, duration.
- `apps/web-app/src/features/trip-planner/components/map/route-polyline.test.tsx` (NEW) — input `[[lon, lat], ...]` produces a `<Polyline>` with `positions={[[lat, lon], ...]}` (the swap is asserted).
- `apps/web-app/src/features/trip-planner/components/map/fit-to-route.test.tsx` (NEW) — `fitBounds` is called once per mount with the right bounds; not called on re-render with the same polyline; not called on pan/zoom events.
- `apps/web-app/src/features/trip-planner/components/trip-map.test.tsx` (NEW) — happy path: lazy chunk imports, map renders, markers count matches stops length, recenter `R` keystroke fires `fitBounds` only when map has focus.
- `apps/web-app/src/features/trip-planner/components/route-summary.test.tsx` — UPDATE: assertion target is the panel-mode JSX, not the `<Card>` wrapper.
- `apps/web-app/src/features/trip-planner/components/trip-detail-panel.test.tsx` — UPDATE: `<RouteSummary />` is mounted inside the Route `SidebarGroup`; the per-leg rows render; the "Departs" line still renders.
- `apps/web-app/src/app/routes/trips-detail.test.tsx` — UPDATE: main area renders `<TripMap />` under `<Suspense>`; loading → `<SpotterLoader />`; 404 from `useTripPlan` → `<Empty>`.
- `apps/web-app/src/features/trip-planner/utils/format-lat-lon.test.ts` (NEW) — pure-function tests.
- `apps/web-app/src/features/trip-planner/utils/keyboard.test.ts` (NEW) — pure-function tests.

### Out (deferred to listed specs)

- **§395.8 Daily Log SVG renderer** → spec 08. The events + days from `useTripPlan` are typed but unconsumed in spec 07.
- **PDF export** → spec 09.
- **Reverse-geocoded `TripStop.label` strings** → future spec. v1 renders `"lat, lon"`.
- **Re-plan on `start_at` edit** → future spec.
- **Custom tile server / Mapbox / MapTiler** → future spec if OSM tile policy becomes restrictive.
- **Offline tiles, route alternatives, traffic overlays** → out of v1.
- **Marker clustering** → out of v1. v1 trips have ≤ ~20 markers (pickup + dropoff + ≤ 2 fuel + breaks + sleepers + restarts); clustering is overkill.
- **Map gesture controls beyond defaults** (rotate, tilt, pitch) → not supported by Leaflet 1.9 (3D is Leaflet 2+ alpha).
- **Driver-profile timezone display in popups** → future spec. v1 hard-codes `America/New_York` in the popup time formatter.
- **§395.1(g) split-sleeper pairing visual indicators** → tied to its parent spec (per spec 05 decision 9).

## Prerequisites (already true)

- Spec 04 is merged on `develop`. `TripsDetailRoute` exists; `TripDetailPanel` exists with the Route `SidebarGroup`; `mockTripPlanned` exists; `useTripById` exists; `RouteSummary` exists with the `<Card>` + `<dl>` shape.
- Spec 05 and spec 06 are merged on `develop`. `GET /api/trips/<id>/plan/` returns the documented envelope; `TripStop` / `LogEvent` / `LogDay` rows are persisted on every successful trip-create.
- `packages/ui` ships `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `Badge`, `Skeleton`, `Empty`, `SpotterLoader`, `Card` / `CardContent`. No new install.
- The `vite.config.ts` (per progress-tracker) currently has no `manualChunks` config; the spec adds it cleanly.
- `apiFetch<T>` + `ApiError` + the MSW harness exist. The Bulletproof React import-direction rules (`import-x/no-restricted-paths`) are in effect; the carve-out for `features/trip-planner/**` to import its own siblings is in place per spec 03.
- `Intl.DateTimeFormat` with `timeZone: "America/New_York"` works in every modern browser the project targets (per `package.json#browserslist`).

## Boundary

- Touches `apps/web-app/package.json`, `apps/web-app/vite.config.ts`, and `apps/web-app/src/features/trip-planner/**` (new `api/trip-plan.ts`, `schemas/trip-plan.ts`, `components/map/**`, `components/trip-map.tsx`, modified `components/route-summary.tsx`, new `utils/format-lat-lon.ts` + `utils/keyboard.ts` + colocated tests).
- Touches `apps/web-app/src/components/app-shell/trip-detail-panel.tsx` (mount `<RouteSummary />`).
- Touches `apps/web-app/src/app/routes/trips-detail.tsx` (replace centered card with lazy map).
- Touches `apps/web-app/src/testing/handlers.ts` (`mockTripPlan`).
- Touches `packages/ui/src/styles/globals.css` (the lone `.leaflet-popup-themed` CSS rule block).
- Touches `context/{architecture.md, progress-tracker.md}` (post-implementation, last commits).
- Does **NOT** touch `apps/web-api/**` (the BE plan endpoint shipped in spec 06; this spec consumes it read-only).
- Does **NOT** touch `apps/web-auth/**`, `packages/eslint-config/**`, `packages/typescript-config/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.
- Does **NOT** touch `apps/web-api/web_api/hos/**` — the spec-05 boundary test still passes verbatim.

**Boundary is FE-only and single-system.** No deviation; the workflow rule "one system boundary per unit" applies cleanly.

## Sequencing

Order matters: deps + Vite config land first so the lazy chunk works; schema + hook land second so the map can consume data; map components land third; `RouteSummary` repurposing + the route change land fourth.

### Step 1 — Deps + Vite config

1. `pnpm --filter web-app add leaflet react-leaflet` (verify versions at install: should resolve `leaflet@1.9.x` and `react-leaflet@5.x`). `pnpm --filter web-app add -D @types/leaflet`.
2. Edit `apps/web-app/vite.config.ts`:

   ```ts
   export default defineConfig({
     // ... existing config
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             "leaflet-vendor": ["leaflet", "react-leaflet", "@react-leaflet/core"],
           },
         },
       },
     },
   });
   ```

3. `pnpm --filter web-app build` — confirm the build emits a `leaflet-vendor-<hash>.js` chunk separate from the entry. Record the chunk size in the PR body.

### Step 2 — Schema + hook + MSW

1. Create `apps/web-app/src/features/trip-planner/schemas/trip-plan.ts`:

   ```ts
   import { z } from "zod";

   export const stopKindSchema = z.enum(["pickup", "dropoff", "fuel", "break", "sleeper", "restart"]);
   export const dutyStatusSchema = z.enum(["off_duty", "sleeper_berth", "driving", "on_duty_not_driving"]);

   export const tripStopSchema = z.object({
     id: z.string().uuid(),
     kind: stopKindSchema,
     sequence: z.number().int().nonnegative(),
     polyline_index: z.number().int().nonnegative(),
     lat: z.coerce.number(),
     lon: z.coerce.number(),
     label: z.string(),
     scheduled_at: z.string().datetime({ offset: true }),
     duration_s: z.number().int().nonnegative(),
   });

   export const logEventSchema = z.object({
     id: z.string().uuid(),
     sequence: z.number().int().nonnegative(),
     status: dutyStatusSchema,
     start: z.string().datetime({ offset: true }),
     duration_s: z.number().int().nonnegative(),
     location: z.string(),
     note: z.string(),
   });

   export const logDaySchema = z.object({
     id: z.string().uuid(),
     date: z.string(), // YYYY-MM-DD
     off_duty_s: z.number().int().nonnegative(),
     sleeper_s: z.number().int().nonnegative(),
     driving_s: z.number().int().nonnegative(),
     on_duty_not_driving_s: z.number().int().nonnegative(),
     total_miles: z.coerce.number(),
   });

   export const tripPlanSchema = z.object({
     trip_id: z.string().uuid(),
     start_at: z.string().datetime({ offset: true }),
     home_terminal_tz: z.string(),
     stops: z.array(tripStopSchema),
     events: z.array(logEventSchema),
     days: z.array(logDaySchema),
   });

   export type StopKind = z.infer<typeof stopKindSchema>;
   export type DutyStatus = z.infer<typeof dutyStatusSchema>;
   export type TripStop = z.infer<typeof tripStopSchema>;
   export type LogEvent = z.infer<typeof logEventSchema>;
   export type LogDay = z.infer<typeof logDaySchema>;
   export type TripPlan = z.infer<typeof tripPlanSchema>;
   ```

2. Create `apps/web-app/src/features/trip-planner/api/trip-plan.ts`:

   ```ts
   import { useQuery } from "@tanstack/react-query";
   import { apiFetch } from "@/lib/api-client";
   import { tripPlanSchema, type TripPlan } from "../schemas/trip-plan";

   const FIVE_MIN = 5 * 60_000;

   async function fetchTripPlan(tripId: string): Promise<TripPlan> {
     const raw = await apiFetch<unknown>(`/api/trips/${tripId}/plan/`);
     return tripPlanSchema.parse(raw);
   }

   export function useTripPlan(tripId: string) {
     return useQuery({
       queryKey: ["trip", tripId, "plan"],
       queryFn: () => fetchTripPlan(tripId),
       staleTime: FIVE_MIN,
       refetchOnWindowFocus: false,
       retry: false,
     });
   }
   ```

3. Edit `apps/web-app/src/testing/handlers.ts`:
   - Add `mockTripPlan(tripId: string, overrides?: Partial<TripPlan>)`: returns an `http.get(/api/trips/:id/plan/, () => HttpResponse.json(...))` handler. The default body matches the spec-05 `assessment_simple` golden translated to wire format.
   - Don't touch the existing `mockTripPlanned` beyond what spec 06 already changed.

### Step 3 — Map sub-components

1. Create `features/trip-planner/components/map/stop-type-colors.ts` per decision 4.
2. Create `features/trip-planner/components/map/marker-icons.tsx`:

   ```tsx
   import L from "leaflet";
   import { STOP_TYPE_CLASSNAMES } from "./stop-type-colors";
   import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

   const ICON_SIZE = 24;

   const ICON_PATHS: Record<StopKind, string> = {
     pickup: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z", // star (load acquired)
     dropoff: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z", // pin (destination)
     fuel: "M3 22V4a2 2 0 012-2h9a2 2 0 012 2v18H3zm14-12h2a2 2 0 012 2v6a1 1 0 11-2 0v-5h-2v-3z", // fuel pump
     break: "M6 4a2 2 0 012-2h8a2 2 0 012 2v3a4 4 0 01-4 4h-4a4 4 0 01-4-4V4z", // mug (30-min break)
     sleeper: "M2 16v-3a4 4 0 014-4h12a4 4 0 014 4v3M2 19v-3M22 19v-3M6 9V5h12v4", // bed (sleeper)
     restart: "M12 2v6m0 8v6m-8.66-15.66l4.24 4.24m8.84 8.84l4.24 4.24M2 12h6m8 0h6", // sun / clock (34h restart)
   };

   export function buildMarkerIcon(kind: StopKind): L.DivIcon {
     // NO inline style — the per-kind CSS class (defined in globals.css) sets the color.
     // This keeps the marker HTML CSP-compatible (no inline style attribute).
     const html = `<span class="trip-marker__icon ${STOP_TYPE_CLASSNAMES[kind]}"><svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICON_PATHS[kind]}"/></svg></span>`;
     return L.divIcon({
       html,
       className: "trip-marker",
       iconSize: [ICON_SIZE, ICON_SIZE],
       iconAnchor: [ICON_SIZE / 2, ICON_SIZE],
     });
   }
   ```

   The `className: "trip-marker"` on the outer Leaflet element suppresses Leaflet's default 1px shadow / border (rule in `globals.css`). The inner `.trip-marker__icon--{kind}` class supplies the color via CSS variable. Concrete CSS lives in the same insertion block as the `.leaflet-popup-themed` rule (decision 8).

3. Create `features/trip-planner/components/map/route-polyline.tsx`:

   ```tsx
   import { Polyline } from "react-leaflet";
   import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";

   type Props = { polyline: Array<[number, number]> /* ORS [lon, lat] */ };

   export function RoutePolyline({ polyline }: Props) {
     const positions = polyline.map<[number, number]>(([lon, lat]) => [lat, lon]);
     return (
       <Polyline
         positions={positions}
         pathOptions={{
           color: "var(--teal-600)",
           weight: 4,
           opacity: 0.85,
         }}
       />
     );
   }
   ```

   The polyline source is `trip.route_polyline` (from spec 04's `TripResponse`), NOT from `useTripPlan`'s response — the plan endpoint emits stops/events/days only. The `<TripMap />` consumes BOTH `trip` (for the polyline) and `plan` (for the stops); both are already in TanStack Query cache by the time the map mounts.

4. Create `features/trip-planner/components/map/stop-marker.tsx`:

   ```tsx
   import { Marker, Popup } from "react-leaflet";
   import { buildMarkerIcon } from "./marker-icons";
   import { MarkerPopup } from "./marker-popup";
   import type { TripStop } from "@/features/trip-planner/schemas/trip-plan";

   export function StopMarker({ stop }: { stop: TripStop }) {
     return (
       <Marker
         position={[stop.lat, stop.lon]}
         icon={buildMarkerIcon(stop.kind)}
         keyboard
         // ^ explicit per spec decision 15 — do not rely on the Leaflet 1.9.4 default
       >
         <Popup className="leaflet-popup-themed">
           <MarkerPopup stop={stop} />
         </Popup>
       </Marker>
     );
   }
   ```

5. Create `features/trip-planner/components/map/marker-popup.tsx` — renders the popup body using shadcn `Badge` + the existing `format-duration` + the new `format-lat-lon` + a small inline `Intl.DateTimeFormat` for the scheduled-time string in `America/New_York`.
6. Create `features/trip-planner/components/map/fit-to-route.tsx`:

   ```tsx
   import { useEffect } from "react";
   import L from "leaflet";
   import { useMap } from "react-leaflet";

   export function FitToRoute({ positions }: { positions: Array<[number, number]> }) {
     const map = useMap();
     const hasPositions = positions.length > 0;
     useEffect(() => {
       if (!hasPositions) return;
       // WHY: see context/specs/07-leaflet-map-renderer.md decision 7 — fit once per
       // non-empty mount. `positions` is intentionally read at effect time (closure)
       // so re-renders with the same length don't re-fit.
       const bounds = L.latLngBounds(positions);
       map.fitBounds(bounds, { padding: [48, 48] });
       // eslint-disable-next-line react-hooks/exhaustive-deps -- positions read via closure
     }, [map, hasPositions]);
     return null;
   }
   ```

   The dep array is `[map, hasPositions]` — fires when positions transition empty → non-empty, never on subsequent re-renders. (Pre-implementation architect-review finding M1.)

### Step 4 — `<TripMap />` composition + lazy mount

1. Create `features/trip-planner/components/trip-map.tsx`:

   ```tsx
   import "leaflet/dist/leaflet.css";
   import { useEffect, useRef } from "react";
   import { MapContainer, TileLayer } from "react-leaflet";
   import type { Map as LeafletMap } from "leaflet";
   import { RoutePolyline } from "./map/route-polyline";
   import { StopMarker } from "./map/stop-marker";
   import { FitToRoute } from "./map/fit-to-route";
   import { isModifierKey } from "@/features/trip-planner/utils/keyboard";
   import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";
   import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";

   type Props = { trip: TripResponse; plan: TripPlan };

   const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

   export default function TripMap({ trip, plan }: Props) {
     const mapRef = useRef<LeafletMap | null>(null);
     const polylinePositions = trip.route_polyline.map<[number, number]>(([lon, lat]) => [lat, lon]);

     useEffect(() => {
       const handler = (e: KeyboardEvent) => {
         if (e.key !== "r" && e.key !== "R") return;
         if (isModifierKey(e)) return;
         const map = mapRef.current;
         if (!map) return;
         if (document.activeElement !== map.getContainer()) return;
         map.fitBounds([...polylinePositions], { padding: [48, 48] });
       };
       window.addEventListener("keydown", handler);
       return () => window.removeEventListener("keydown", handler);
     }, [polylinePositions]);

     return (
       <MapContainer
         ref={mapRef}
         className="size-full"
         center={[37.7749, -122.4194]}
         zoom={4}
         tabIndex={0}
         aria-label="Trip route map. Tab through stops to read details; press R to recenter."
       >
         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={OSM_ATTRIBUTION} />
         <RoutePolyline polyline={trip.route_polyline} />
         {plan.stops.map((stop) => (
           <StopMarker key={stop.id} stop={stop} />
         ))}
         <FitToRoute positions={polylinePositions} />
       </MapContainer>
     );
   }
   ```

   `export default function TripMap` — default export is intentional, makes `React.lazy(() => import("./trip-map"))` ergonomic (the default-export convention pairs with `lazy`'s default-import resolution).

2. Update `apps/web-app/src/app/routes/trips-detail.tsx`:

   ```tsx
   import { lazy, Suspense } from "react";
   import { useParams } from "react-router";
   import { useTripById } from "@/features/trip-planner/api/trip-by-id";
   import { useTripPlan } from "@/features/trip-planner/api/trip-plan";
   import { SpotterLoader } from "@outbound/ui/components/spotter-loader";
   import { Empty, EmptyTitle, EmptyDescription } from "@outbound/ui/components/ui/empty";
   import { Link } from "react-router";

   const TripMap = lazy(() => import("@/features/trip-planner/components/trip-map"));

   export function TripsDetailRoute() {
     const { id } = useParams<{ id: string }>();
     const trip = useTripById(id);
     const plan = useTripPlan(id ?? "");

     if (trip.isPending || plan.isPending) return <SpotterLoader size="lg" />;
     // Trip-404 and Plan-404 render distinct copy per decision 16:
     // trip-404 → "Trip not found" with link to plan a new trip (the trip is gone).
     // plan-404 → "Trip data missing" with no link (the trip exists; a new one is the wrong action).
     if (trip.isError) {
       return (
         <Empty>
           <EmptyTitle>Trip not found.</EmptyTitle>
           <EmptyDescription>
             This trip may have been deleted. <Link to="/trips/new">Plan a new trip</Link>.
           </EmptyDescription>
         </Empty>
       );
     }
     if (plan.isError) {
       return (
         <Empty>
           <EmptyTitle>Trip data missing.</EmptyTitle>
           <EmptyDescription>
             The plan for this trip didn't load. Try again, or contact support if this persists.
           </EmptyDescription>
         </Empty>
       );
     }

     return (
       <Suspense fallback={<SpotterLoader size="lg" />}>
         <TripMap trip={trip.data} plan={plan.data} />
       </Suspense>
     );
   }
   ```

### Step 5 — Repurpose `RouteSummary` + mount in `TripDetailPanel`

1. Edit `apps/web-app/src/features/trip-planner/components/route-summary.tsx`:
   - Drop the outer `<Card>` + `<CardContent>` wrappers.
   - Return the `<dl>` body directly.
   - The function signature stays `function RouteSummary({ trip }: { trip: TripResponse })`.
   - The PLANNING / FAILED branches are already gone post-spec-04-amendment; only the planned shape renders.
2. Edit `apps/web-app/src/components/app-shell/trip-detail-panel.tsx`:
   - Add a `<SidebarGroup>` titled "Route" (via `<SidebarGroupLabel>Route</SidebarGroupLabel>`).
   - Inside, render `<RouteSummary trip={trip} />`. Add the "Departs at" line (already shipped in spec 06) within the same SidebarGroup.
3. The `app/routes/trips-detail.tsx` main area no longer renders `<RouteSummary />`; spec 07 replaces it with `<TripMap />` (Step 4 sub-step 2).

### Step 6 — Global CSS override

1. Edit `packages/ui/src/styles/globals.css`. Add the rule block at the bottom (or in a clearly-marked "Third-party component overrides" section if other overrides exist; otherwise create one). Confirm BEFORE writing the rule that the `--shadow-md` token exists in the file; if it does not, substitute `0 2px 8px rgb(0 0 0 / 0.12)` or the closest existing shadow token (pre-implementation architect-review noted the dependency).

   ```css
   /* Leaflet popup + marker theming — spec 07 (no token additions; defers to existing tokens) */
   .leaflet-popup-themed .leaflet-popup-content-wrapper {
     background: var(--popover);
     color: var(--popover-foreground);
     border: 1px solid var(--border);
     border-radius: var(--radius-lg);
     box-shadow: var(--shadow-md);
   }
   .leaflet-popup-themed .leaflet-popup-tip {
     background: var(--popover);
     border: 1px solid var(--border);
   }
   .leaflet-popup-themed .leaflet-popup-close-button {
     color: var(--muted-foreground);
   }
   .trip-marker {
     /* Suppresses Leaflet's default 1px shadow; the inline SVG carries its own visual weight. */
     background: transparent;
     border: 0;
   }
   .trip-marker__icon {
     display: inline-flex;
   }
   .trip-marker__icon--pickup {
     color: var(--teal-500);
   }
   .trip-marker__icon--dropoff {
     color: var(--red-500);
   }
   .trip-marker__icon--fuel {
     color: var(--teal-300);
   }
   .trip-marker__icon--break {
     color: var(--teal-400);
   }
   .trip-marker__icon--sleeper {
     color: var(--teal-700);
   }
   .trip-marker__icon--restart {
     color: var(--teal-800);
   }
   ```

   The six per-kind `.trip-marker__icon--*` rules retire the CSP-compatibility open question (pre-implementation architect-review finding m4); marker HTML no longer carries any inline `style` attribute. Each rule references the token documented in `STOP_TYPE_TOKENS` (`stop-type-colors.ts`); a unit test asserts the two stay in sync.

2. `pnpm exec turbo run build --filter=@outbound/ui` to confirm no Tailwind v4 `@theme inline` regression.

### Step 7 — Manual browser smoke

Run all three dev servers (same as spec 04 / 06):

```bash
cd apps/web-api && uv run python manage.py migrate && uv run python manage.py runserver 0.0.0.0:8000
pnpm --filter web-auth dev
pnpm --filter web-app dev
```

Browser walk:

1. Open `/trips/new`. Submit the golden trip (Richmond → Fredericksburg → Newark, 0 cycle hours, default `start_at`). Land on `/trips/:id`.
2. Assert: the main area shows the Leaflet map filling the available width. The route polyline runs Richmond → Fredericksburg → Newark in `var(--teal-600)`. Three markers are visible: pickup (teal-500), dropoff (red-500), and any intermediate stops (per spec 05's golden ~5 events translated to stops via spec 06's `_stop_kind_from_event`). Side panel shows the Route SidebarGroup with the route metrics + the "Departs" line.
3. Click each marker — popup opens with the kind chip, scheduled time, location string, duration. Popup chrome matches the shadcn `<Popover>` look.
4. Press Tab — focus lands on a marker (Leaflet 1.9 default behavior). Press Enter — popup opens. Press Escape — popup closes. Press R while map has focus — re-fits to route.
5. Mobile (375×667): map still fills the main area; the side panels collapse per the existing app-shell rules; markers remain tappable; popups render fully on-screen.
6. Production build smoke: `pnpm --filter web-app build`. Confirm `dist/assets/leaflet-vendor-<hash>.js` exists separate from the entry chunk. **Also confirm the leaflet CSS lands as a separate chunk-CSS asset** (`dist/assets/*leaflet*.css` or a `.css` companion to `leaflet-vendor-<hash>.js`), NOT folded into the main entry `index-<hash>.css` (pre-implementation architect-review finding m3). Confirm entry-chunk size delta vs. `develop` is ≤ +5 KB. Record all three measurements in PR body.
7. `View-source` on a non-trip route (`/trips/new`): confirm leaflet-vendor-`*.js` and the leaflet CSS asset are NOT loaded.
8. **OSM attribution check**: open `/trips/:id`, confirm `© OpenStreetMap contributors` renders in the bottom-right corner of the map (the `.leaflet-control-attribution` element). Confirm the spec's `.leaflet-popup-themed` and `.trip-marker*` CSS rules do not accidentally hide it (pre-implementation architect-review finding m8).

### Step 8 — Sub-agent passes

Run in this order against the diff (architect-review against the spec text fires BEFORE Step 1 — same precedent as spec 04 / 05 / 06):

1. `architect-review` (`comprehensive-review`) — **First, against the SPEC TEXT** before implementation begins. Then against the diff.
2. `code-reviewer` (`comprehensive-review`) — mandatory before PR.
3. `typescript-pro` (`javascript-typescript`) — mandatory. React 19 / Suspense / `React.lazy` patterns, zod refinements, TanStack Query v5 patterns.
4. `ui-visual-validator` (`accessibility-compliance`) — mandatory. Map keyboard reachability, marker contrast against the OSM tile colors, popup contrast, `prefers-reduced-motion` honored on the fit-to-route animation, `aria-label` quality, focus indicators in dense mode.
5. `wcag-audit-patterns` skill — auto-trigger. Interactive map widget patterns (WCAG 2.1.1, 2.4.7).
6. `performance-engineer` (`application-performance`) — mandatory. Bundle delta (leaflet-vendor chunk separated, entry chunk ≤ +5 KB), fit-to-route fires exactly once, no layout thrash on marker render.
7. `security-auditor` — skip. No auth-surface change. No new endpoints. No new env vars.

### Step 9 — Tracker + architecture updates (last commits)

- `context/architecture.md`:
  - **Stack** — confirm `leaflet@1.9.4` + `react-leaflet@5.x` pins are already listed (they are per spec 04 stack table); no row addition.
  - **System Boundaries** — extend the `apps/web-app` bullet noting the lazy-loaded leaflet sub-chunk.
- `context/progress-tracker.md` — record completion under `## Completed`; clear `## In Progress`; reshuffle `## Next Up` (spec 08 = §395.8 SVG renderer; spec 09 = PDF export; spec 10 = reverse-geocoding labels).

## File-level deliverables

```
apps/web-app/
├── package.json                                                # MODIFY: + leaflet, react-leaflet, @types/leaflet (devDependencies)
├── vite.config.ts                                              # MODIFY: + build.rollupOptions.output.manualChunks
└── src/
    ├── app/routes/trips-detail.tsx                             # MODIFY: lazy <TripMap />; isPending / isError branches
    ├── components/app-shell/trip-detail-panel.tsx              # MODIFY: mount <RouteSummary /> inside Route SidebarGroup
    ├── features/trip-planner/
    │   ├── api/
    │   │   ├── trip-plan.ts                                    # NEW: useTripPlan TanStack Query hook
    │   │   └── trip-plan.test.ts                               # NEW
    │   ├── schemas/
    │   │   ├── trip-plan.ts                                    # NEW: zod schemas for plan envelope
    │   │   └── trip-plan.test.ts                               # NEW
    │   ├── components/
    │   │   ├── trip-map.tsx                                    # NEW: lazy-loaded composition root
    │   │   ├── trip-map.test.tsx                               # NEW
    │   │   ├── route-summary.tsx                               # MODIFY: panel render mode (drop <Card>)
    │   │   ├── route-summary.test.tsx                          # MODIFY
    │   │   └── map/
    │   │       ├── stop-type-colors.ts                         # NEW
    │   │       ├── marker-icons.tsx                            # NEW: L.divIcon factories
    │   │       ├── marker-icons.test.tsx                       # NEW
    │   │       ├── route-polyline.tsx                          # NEW: <Polyline> wrapper + lon/lat swap
    │   │       ├── route-polyline.test.tsx                     # NEW
    │   │       ├── stop-marker.tsx                             # NEW: <Marker> + <Popup>
    │   │       ├── stop-marker.test.tsx                        # NEW
    │   │       ├── marker-popup.tsx                            # NEW: popup body
    │   │       ├── fit-to-route.tsx                            # NEW: useMap hook component
    │   │       └── fit-to-route.test.tsx                       # NEW
    │   └── utils/
    │       ├── format-lat-lon.ts                               # NEW
    │       ├── format-lat-lon.test.ts                          # NEW
    │       ├── keyboard.ts                                     # NEW
    │       └── keyboard.test.ts                                # NEW
    └── testing/handlers.ts                                     # MODIFY: + mockTripPlan

packages/ui/src/styles/globals.css                              # MODIFY: + .leaflet-popup-themed + .trip-marker rule block

context/
├── architecture.md                                             # MODIFY (post-implementation): System Boundaries note on leaflet chunk
└── progress-tracker.md                                         # MODIFY (post-implementation, LAST commit)
```

No `pyproject.toml` change. No `apps/web-api/**` change. No `packages/typescript-config` / `packages/eslint-config` change. Two new TS deps (`leaflet`, `react-leaflet`) + one new devDep (`@types/leaflet`).

## Existing functions / utilities to reuse (do not re-implement)

- `apps/web-app/src/features/trip-planner/api/trip-by-id.ts::useTripById` — already returns the `TripResponse` shape with `route_polyline`. `<TripMap />` reads `trip.route_polyline` from this hook's cache.
- `apps/web-app/src/features/trip-planner/utils/format-duration.ts` and `format-distance.ts` — used in `<MarkerPopup />`.
- `apps/web-app/src/lib/api-client.ts::apiFetch` / `ApiError` — used in `useTripPlan`.
- `packages/ui::SpotterLoader` for the Suspense fallback.
- `packages/ui::Empty / EmptyTitle / EmptyDescription` for the load-failure branch.
- `packages/ui::Badge` for the stop-kind chip in the popup.
- `packages/ui::SidebarGroup / SidebarGroupLabel / SidebarGroupContent` for the panel re-mount of `<RouteSummary />`.
- Existing theme tokens in `packages/ui/src/styles/globals.css` (`--teal-*`, `--red-*`, `--popover`, `--popover-foreground`, `--border`, `--radius-lg`, `--shadow-md`, `--muted-foreground`) — every color / radius / shadow on the map references these. No new tokens added; no token edits.

## Architecture invariants verified

- **#1 (HOS planner pure Python)** — N/A (FE-only). The spec-05 boundary test is untouched.
- **#2 (every duty-status change writes a LogEvent)** — preserved. Spec 07 reads `LogEvent` rows but never writes them.
- **#3 (no raw ORS calls from browser)** — preserved. The FE only calls `/api/trips/<id>/plan/` and `/api/trips/<id>/`; ORS still server-side only.
- **#4 (no client-side HOS math)** — primary upholder. The map renders persisted `TripStop` rows and the persisted `route_polyline`; it computes nothing. The "is this a valid §395.8 trip" question lives entirely server-side.
- **#5 (ownership-checked mutations + retrievals)** — preserved. `useTripPlan` hits the spec-06 endpoint that already ownership-gates via `get_queryset` filtering on `request.user_id`.
- **#6 (PDF export client-only)** — N/A (spec 09).
- **#7 (theme tokens only)** — primary upholder. `STOP_TYPE_CLASSNAMES` maps each `StopKind` to a per-kind CSS class; `STOP_TYPE_TOKENS` documents the underlying theme variable each class resolves to (`--teal-*` / `--red-*`). The CSS rules in `packages/ui/src/styles/globals.css` are the single point where token → kind binds. `marker-icons.tsx` emits HTML with `class="trip-marker__icon trip-marker__icon--{kind}"` — NO inline `style` attribute, NO hex literals anywhere. Verified by `marker-icons.test.tsx` assertions: `.toContain(STOP_TYPE_CLASSNAMES[kind])` AND `.not.toMatch(/style="[^"]*color/)` AND `.not.toMatch(/#[0-9a-fA-F]{3,8}/)`. A separate fixture-stylesheet test asserts the six `.trip-marker__icon--{kind}` CSS rules reference the tokens documented in `STOP_TYPE_TOKENS` (drift detection).
- **#8 (no custom sub-agents)** — all reviewers from `wshobson/agents`.
- **#9 (specs drive implementation)** — this is the spec.

## Sub-agents to invoke

| Agent (plugin)                                     | When                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architect-review` (`comprehensive-review`)        | **First — against the SPEC TEXT** before implementation begins. Catches design drift on the lazy-load contract, the fit-to-route once-only rule, the React-Leaflet@5 + React 19 interaction. Then again against the diff. |
| `code-reviewer` (`comprehensive-review`)           | Mandatory before PR.                                                                                                                                                                                                      |
| `typescript-pro` (`javascript-typescript`)         | Mandatory — React 19 / Suspense / `React.lazy`, zod patterns, TanStack Query v5 cache keying, react-leaflet@5 imperative API.                                                                                             |
| `ui-visual-validator` (`accessibility-compliance`) | Mandatory — keyboard nav, marker contrast, popup contrast, `aria-label`, focus indicators, `prefers-reduced-motion`.                                                                                                      |
| `performance-engineer` (`application-performance`) | Mandatory — bundle split, fit-to-route reflow cost, marker render perf, OSM tile request rate vs. the policy.                                                                                                             |
| `security-auditor`                                 | Skip — no auth surface, no new endpoints, no new env vars.                                                                                                                                                                |

Auto-trigger: `react-architecture`, `react-doctor` (every `.tsx`), `react-vite-best-practices` (the `vite.config.ts` touch), `shadcn` (any new shadcn composition — though none added here), `tailwind-theme-builder` (the `globals.css` touch).

## Citations to include inline (or in PR body)

- React-Leaflet v5: <https://react-leaflet.js.org/>
- Leaflet 1.9.4 API reference: <https://leafletjs.com/reference.html>
- OpenStreetMap Tile Usage Policy: <https://operations.osmfoundation.org/policies/tiles/>
- Vite `manualChunks` docs: <https://vite.dev/config/build-options.html>
- WCAG 2.2 SC 2.1.1 (Keyboard): <https://www.w3.org/WAI/WCAG22/Understanding/keyboard>
- WCAG 2.2 SC 2.4.7 (Focus Visible): <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible>
- WAI-ARIA `role="application"` semantics: <https://www.w3.org/WAI/ARIA/apg/practices/application/>
- React 19 `Suspense` + `lazy`: <https://react.dev/reference/react/lazy>
- TanStack Query v5 `queryKey` + `staleTime`: <https://tanstack.com/query/v5/docs/framework/react/guides/query-keys>
- zod `discriminatedUnion` / `coerce`: <https://zod.dev>
- `Intl.DateTimeFormat` `timeZone` option: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/DateTimeFormat>
- `docs/theme.md` — teal / red ramps.
- `context/ui-context.md#Component density` — popup density rules.

Third-party versions verified at PR-write time via `npm view <pkg> version`; resolved versions recorded in the PR body.

## UI anti-patterns to avoid

1. **NO "Map" title above the map.** The page header already says "Trip workspace"; another title duplicates per the spec-04 anti-pattern precedent.
2. **NO legend duplicating the marker tooltip content.** A static color/kind legend would force the user to cross-reference between the legend and the marker; the popup-on-click is the single canonical surface.
3. **NO Leaflet stock blue marker pin.** Off-brand and confusing — Leaflet's default visual sits inside the route-style decisions of every other Leaflet app. Spec 07 replaces every marker via `L.divIcon` (decision 3).
4. **NO miles AND kilometers display.** The assessment is US-only and `docs/assesment.md` doesn't mention metric. Distances are formatted by `format-distance.ts` (miles only).
5. **NO full-screen loader on plan refetch.** A 404 / network error gets the `<Empty>` block; a successful refetch with stale data renders the existing map until new data lands. The `staleTime: 5*60_000` makes refetch rare anyway.
6. **NO auto-recenter on later interactions.** Fit-to-route fires ONCE on mount. The user's pan / zoom intent is sovereign.
7. **NO "Recenter" button without a keyboard binding.** The recenter affordance is bound to `R` when the map has focus (decision 15). If a future spec adds a visible button, it must reference the same handler — never duplicate the bounds-calc.
8. **NO Tailwind-on-Leaflet hover/focus state hijacking.** Leaflet's marker/popup classes are CSS-modular; the global `.leaflet-popup-themed` + `.trip-marker` rule blocks are the only override surface.
9. **NO comments restating the code.** Comments only for the WHY. The single `eslint-disable react-hooks/exhaustive-deps` in `fit-to-route.tsx` carries a one-line citation to this spec — that's a WHY.
10. **NO unused exports.** Every export in `schemas/trip-plan.ts` is consumed by `trip-map.tsx` or the colocated tests. The future-only `LogEvent` / `LogDay` types are exported because the spec-08 SVG renderer consumes them — that callsite ships next spec.

## Verification (the unit is not done until every box is ticked)

- [ ] `pnpm exec turbo run lint typecheck test build --filter=web-app --filter=@outbound/ui` is green.
- [ ] `pnpm format:check` is green.
- [ ] `cd apps/web-api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest` is green (no BE changes; spec-04/05/06 suites still pass).
- [ ] CI grep / spec-05 boundary test still passes — `web_api/hos/**` untouched.
- [ ] Build output: `dist/assets/leaflet-vendor-<hash>.js` chunk exists separate from the entry chunk; size recorded in PR body.
- [ ] Entry-chunk size delta vs. `develop` ≤ +5 KB (the lazy boundary overhead). Recorded in PR body.
- [ ] No hex literals or raw `bg-*-500`-style Tailwind colors in any file under `apps/web-app/src/features/trip-planner/components/map/**`. `marker-icons.test.tsx` asserts the rendered HTML (a) contains zero `#`-prefixed color tokens AND (b) contains zero `style="..."` attributes (architect-review M2 + m4 — CSP-safe).
- [ ] `fit-to-route` fires once per non-empty mount; not on pan, not on zoom, not on marker click; not on empty positions (architect-review M1). Asserted in `fit-to-route.test.tsx`.
- [ ] Recenter `R` keystroke fires ONLY when the map has focus. Asserted in `trip-map.test.tsx`.
- [ ] Every `StopKind` resolves to a class in `STOP_TYPE_CLASSNAMES` AND a token in `STOP_TYPE_TOKENS`; both maps exhaustive (Vitest `expectTypeOf<Record<StopKind, string>>()`). A fixture-stylesheet test asserts the CSS `.trip-marker__icon--{kind} { color: var(--{token}); }` rules match `STOP_TYPE_TOKENS` (drift detection).
- [ ] OSM attribution renders in the map's bottom-right corner (`.leaflet-control-attribution` not hidden by our CSS). Asserted in `trip-map.test.tsx` AND in the manual smoke (Step 7 sub-step 8).
- [ ] Trip 404 → `<Empty>` with "Trip not found" + plan-a-new-trip link; plan 404 → `<Empty>` with "Trip data missing" copy (no new-trip link) (architect-review m1). Asserted in `trips-detail.test.tsx`.
- [ ] `<Marker keyboard>` is passed explicitly on every marker (architect-review m6); not relying on the Leaflet 1.9.4 default.
- [ ] `manualChunks` includes `@react-leaflet/core` alongside `leaflet` + `react-leaflet` (architect-review m2); `pnpm why @react-leaflet/core` output recorded in the PR body.
- [ ] Leaflet CSS lands as a separate chunk-CSS asset, NOT in the main entry CSS (architect-review m3). Asserted via `grep` on `dist/assets/` in the manual smoke (Step 7 sub-step 6).
- [ ] Manual browser smoke (Step 7) walks the golden trip on mobile 375×667 + desktop 1440×900. Screenshots in PR body of the map + the side panel + a sample popup. Production build smoke confirms leaflet-vendor chunk is split.
- [ ] `code-reviewer`, `architect-review` (against the diff), `typescript-pro`, `ui-visual-validator`, `performance-engineer` have reviewed the diff; no unresolved CRITICAL findings.
- [ ] Branch `feat/07-leaflet-map-renderer`; PR base `develop`.
- [ ] `.github/pull_request_template.md` filled verbatim; Conventional Commit subjects (`feat(map): …`, `feat(web-app): …`, `test(web-app): …`, etc.); no `Co-Authored-By` trailer; no `--no-verify`.
- [ ] `context/architecture.md` updated with the leaflet-chunk note under System Boundaries.
- [ ] `context/progress-tracker.md` updated as the **last** committed file — spec 07 → Completed; Next Up updated (spec 08 = §395.8 SVG; spec 09 = PDF; spec 10 = reverse-geocoding).

## Out of scope (deliberate — don't touch in this unit)

- §395.8 Daily Log SVG renderer → spec 08. `events` and `days` from `useTripPlan` are typed but not rendered here.
- PDF export → spec 09.
- Reverse-geocoded `TripStop.label` strings → future spec.
- Custom tile provider (Mapbox / MapTiler / self-hosted OSM) → future spec.
- Re-plan-on-edit for `start_at` → future spec.
- Marker clustering → out of v1 (≤ ~20 markers per trip).
- §395.1(g) split-sleeper pairing visual indicators → future spec (tied to its parent).
- Driver-profile TZ display → future spec.
- Mobile gesture customization (rotate / tilt / pitch) → not supported by Leaflet 1.9; out of v1.
- 3D / terrain layers, traffic overlay, route alternatives → out of v1.
- Map screenshot / share / embed → out of v1.

## Open questions

None blocking at write time. Four known-unknowns documented for the implementer (resolve inline + record in `progress-tracker.md` if encountered):

- **Leaflet + React 19 StrictMode double-mount.** React 19's StrictMode (already enabled in `apps/web-app/src/main.tsx`) double-invokes effects in dev. Leaflet's `MapContainer` cleans up on unmount via react-leaflet's reconciler, but the imperative `L.Map` instance held in the ref may double-attach handlers if the cleanup isn't precise. v1 ships against `react-leaflet@5` which advertises StrictMode support; if double-mount surfaces, downgrade to `react-leaflet@4` + a peer-dep override and document the decision.
- **OSM tile policy enforcement.** The policy allows usage so long as the User-Agent identifies the app and bulk users add caching / a commercial provider. The assessment review traffic is bounded; if the OSM tile server starts rate-limiting (HTTP 418 / 429), switch to Carto Voyager (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png` — also free, also requires attribution).
- **`L.divIcon` HTML and CSP — retired.** Earlier drafts injected inline `style="color:..."` on marker spans, which would have required a CSP exception once CSP shipped. Pre-implementation architect-review finding m4 refactored markers to use per-kind CSS classes (`.trip-marker__icon--pickup`, etc.); the HTML now carries only `class="..."`, so a future CSP can disallow inline styles globally without touching the map.
- **Suspense + TanStack Query interaction.** The lazy `<TripMap />` is wrapped in `<Suspense>` per Step 4. The TanStack Query hooks (`useTripById`, `useTripPlan`) are NOT Suspense-mode queries by default — they use `isPending` / `isError` branches. The spec keeps it that way (no Suspense for data, only for code-splitting). If a future spec migrates the queries to `useSuspenseQuery`, the route's branching simplifies but the error-boundary placement needs revisiting.
