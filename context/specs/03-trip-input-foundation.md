# 03 — Trip Input Foundation

> Lands the persistent app shell for `apps/web-app`, the assessment-mandatory trip-input form (three addresses + cycle hours), an OpenRouteService Pelias proxy on `apps/web-api`, and a stub `Trip` create endpoint. Frontend + backend cross the boundary intentionally as a single vertical slice — see "Boundary" for the explicit justification. Builds on specs 01 (`packages/ui` primitives + theme + brand) and 02 (Clerk auth flow on `apps/web-auth`).

## Goal

Deliver the assessment's mandatory input surface end-to-end. A signed-in driver lands on the app shell → fills three addresses with live Pelias autocomplete → drags / types cycle-hours-used → submits → sees a deterministic loading state → arrives at a placeholder `/trips/:id` workspace that later specs extend. Every architecture invariant from `context/architecture.md` holds: the ORS API key stays server-side (#3), no client-side HOS math (#4), JWT enforced on every mutation (#5), semantic tokens only in components (#7), HOS planner untouched (#1).

The four user-visible additions:

1. **App shell** for `apps/web-app` — sidebar + header + content. Inspired by shadcn `sidebar-09` (the dual-nested mail layout) but reduced to a **single icon-collapsible rail** because the planner doesn't yet have a list-pane to fill a second panel. The shell is the foundation that later specs extend (Saved Trips list, Trip workspace, etc.).
2. **Trip-input form** — three address `Combobox` fields wired to a debounced Pelias autocomplete + a `Slider` + numeric mirror for cycle hours, with React Hook Form + zod validation, inline errors, and a submit flow that POSTs to a stub `/api/trips/` endpoint then navigates to a `/trips/:id` placeholder workspace.
3. **OpenRouteService Pelias proxy** on `apps/web-api` — required by architecture invariant #3. Two thin DRF endpoints (`/api/geocode/autocomplete/`, `/api/geocode/search/`) forward to ORS with the server-held API key.
4. **Custom profile bubble** in the sidebar footer — `Avatar` + `DropdownMenu` hydrated from Clerk's `useUser()` / `useAuth()` hooks. **Not** Clerk's `<UserButton />` (deliberate: the brand owns its identity surface and the dropdown also hosts our `ThemeToggle`).

## Decisions of record (resolved at planning time)

These were resolved before authoring; they live here so future implementers don't re-litigate and senior review can audit the rationale.

1. **Single vertical slice over a FE/BE split.** `context/ai-workflow-rules.md#Scoping rules` says split FE/BE into ordered units. The deviation is approved because (a) the BE surface is limited to a thin proxy + a stub trip echo (no Trip business logic, no HOS, no ORS Directions), (b) the FE depends on the proxy to satisfy invariant #3 (zero browser-side ORS calls), and (c) splitting would force a contract-only intermediate spec that delivers no user-visible value.
2. **Spec order reshuffled.** Before this spec, `context/progress-tracker.md#Next Up` had `feat/03-hos-planner-foundation` queued. The trip-input surface unblocks user testing of the harder UX path earlier and lets the HOS planner land against a real form, so the new order is `03 = trip input + shell` → `04 = ORS Directions + Trip model upgrade` → `05 = HOS planner foundation`.
3. **Autocomplete-as-you-type** for address resolution (debounced 250 ms → `/api/geocode/autocomplete/`). Tradeoff: heavier on the HeiGIT standard-plan geocoding quota (~1000 req/day) than resolve-on-blur, but materially better UX. Mitigation: client-side dedupe via TanStack Query (`staleTime: 5 * 60_000`) so each unique substring is fetched at most once per 5 min per session.
4. **Slider + numeric input** for cycle-hours-used. Per `UI.md §3.1` — drag-tap on phone, type on desktop. A `Progress` band underneath shows the remaining cycle window so the driver sees the constraint, not just the count.
5. **Submit navigates to `/trips/:id` placeholder.** The form POSTs resolved geocodes to a stub `POST /api/trips/` that creates a `Trip` row + echoes back the UUID. `/trips/:id` then renders a `Skeleton`-filled workspace with a "Plan computation lands in the next spec" banner. Sets up the routing surface that spec 04 fills in without churning the URL.

## Scope

### In

**`packages/ui` (CLI installs only — no hand-edits in `components/ui/*`):**

- `sidebar`, `sheet`, `dropdown-menu`, `avatar`, `tooltip`, `slider`, `popover`, `command`, `breadcrumb`, `collapsible`, `dialog`, `progress` shadcn primitives.

**`apps/web-app` — shell:**

- `components/app-shell/app-shell-layout.tsx` — route-level layout component. Wraps `<SidebarProvider>` + `<AppSidebar>` + a sticky header with breadcrumb + `<SidebarTrigger>` + `<Outlet />` for nested route content.
- `components/app-shell/app-sidebar.tsx` — single-rail `<Sidebar collapsible="icon">`. Header = `BrandMark` (collapsed: mark-only; expanded: full). Nav = New Trip (primary, `Plus` icon, links to `/trips/new`) + Saved Trips (disabled placeholder, `History` icon, `Tooltip` "Coming soon"). Footer = `<NavUser>`.
- `components/app-shell/nav-user.tsx` — `Avatar` (imageUrl from `useUser()`, fallback initials from first+last name) + `DropdownMenu` containing: header row (name + email), divider, `ThemeToggle` row, divider, Sign out (calls `useAuth().signOut()` then `<Navigate>` to web-auth). **Not** Clerk's `<UserButton />`.
- `components/app-shell/sidebar-trigger.tsx` — wraps the shadcn `<SidebarTrigger>` with a global `Cmd+B` / `Ctrl+B` keyboard binding (per shadcn sidebar docs).

**`apps/web-app` — `features/trip-planner/` (Bulletproof):**

- `schemas/trip-input.ts` — single zod schema:
  - `resolvedAddress = z.object({ kind: z.literal("resolved"), label, lat, lon, confidence })`
  - `freeTextAddress = z.object({ kind: z.literal("free-text"), text })` (intermediate state — rejected at submit-time)
  - `cycleHoursUsed = z.number().min(0).max(70).multipleOf(0.5)`
  - `tripInputSchema = z.object({ current: resolvedAddress, pickup: resolvedAddress, dropoff: resolvedAddress, cycleHoursUsed })`
- `api/geocode-autocomplete.ts` — TanStack Query `useQuery` keyed `["geocode","autocomplete",text]`, `staleTime: 5*60_000`, hits `/api/geocode/autocomplete/?text=…`. Skips when text length < 3.
- `api/plan-trip.ts` — TanStack Query `useMutation`; POSTs to `/api/trips/` with the parsed payload; on success navigates to `paths.tripsDetail(data.id)`; on error toasts via `sonner`.
- `components/address-field.tsx` — `Combobox` built from shadcn `Command` + `Popover`. Local state holds the search text; `useGeocodeAutocomplete(debouncedText)` drives the dropdown. Selecting a suggestion writes `{kind:"resolved", label, lat, lon, confidence}` into RHF state. Empty state, loading state, no-results state, error state all rendered explicitly (UI.md §8).
- `components/cycle-hours-field.tsx` — `Slider` 0–70 step 0.5 + `<Input inputmode="decimal">` mirror, both bound to the same RHF field. Underneath: `Progress` band filled to `(70 - value) / 70 * 100`, with `text-xs text-muted-foreground` label "≈ {70 - value} h remaining in 8-day cycle".
- `components/use-current-location.tsx` — small button next to the current-location field. Calls `navigator.geolocation.getCurrentPosition`, reverse-geocodes the result via `/api/geocode/search/?text=<lat,lon>` (the same endpoint accepts reverse via Pelias). Graceful toast when denied / unavailable.
- `components/trip-input-form.tsx` — `Card` + `Form` + `FieldGroup` composition. Submit button: full-width on mobile (`h-12`), inline-right on desktop (`h-10`). Disabled until the schema passes; tooltip on hover explains why. Loading state during the mutation shows `SpotterLoader` + phased label "Saving trip…" (single phase for now; spec 04 expands).

**`apps/web-app` — routes & paths:**

- `app/routes/trips-new.tsx` — auth-gated; renders the trip-input form as `<Outlet />` content of the shell.
- `app/routes/trips-detail.tsx` — auth-gated; reads `:id` from the URL; fetches the trip via `GET /api/trips/:id/` (TanStack Query); renders three resolved address rows + cycle hours + a `Skeleton` strip with the banner "Plan computation lands in the next spec". 404 → `<Empty>` state with a link back to `/trips/new`.
- `app/routes/index-redirect.tsx` — `/` `<Navigate replace to={paths.tripsNew}>` for signed-in users (the `<RequireAuth>` wrapper above runs first and bounces unsigned users to web-auth).
- `app/router.tsx` — refactored: a parent layout route `path: paths.root, element: <AppShellLayout />` wraps children. Children: index (`<IndexRedirect />`), `trips/new` (`<TripsNew />`), `trips/:id` (`<TripsDetail />`).
- `config/paths.ts` — extends to `{ root: "/", tripsNew: "/trips/new", tripsDetail: (id: string) => \`/trips/${id}\` }` (function-key pattern for parametric paths).

**`apps/web-api` — ORS Pelias proxy + stub `Trip`:**

- `web_api/integrations/openrouteservice.py` — typed `requests`-based client. Public surface:
  - `@dataclass(frozen=True, slots=True) class PeliasFeature: label, country_a, region_a, locality, confidence, match_type, lat, lon`
  - `def geocode_autocomplete(text: str, *, focus: tuple[float, float] | None = None, size: int = 5) -> list[PeliasFeature]`
  - `def geocode_search(text: str, *, size: int = 1) -> list[PeliasFeature]`
  - Reads `OPENROUTESERVICE_API_KEY` from settings. Sends `Authorization: <api_key>` header (per `context/architecture.md#External integrations`).
  - Hard-coded `boundary.country=US`; `size` clamped to `[1, 10]`; request timeout 5 s.
  - Errors: `OrsRateLimitError` (HTTP 429), `OrsUpstreamError` (5xx), `OrsRequestError` (4xx). Caught + remapped to DRF responses at the view boundary.
- `web_api/apps/geocoding/` — new Django app (registered in `INSTALLED_APPS`):
  - `views.py` — two `APIView` subclasses (`GeocodeAutocompleteView`, `GeocodeSearchView`); both `permission_classes = [IsAuthenticated]`; both validate `text` (`length 1..200`) before forwarding; both serialize the response via `PeliasFeatureSerializer`.
  - `serializers.py` — request schema (`text`, optional `focus_lat`, `focus_lon`) + response schema (matches `PeliasFeature`).
  - `urls.py` — `path("autocomplete/", …)`, `path("search/", …)`.
  - `tests/test_geocoding.py` — 401 (no token), 403 (bad token), 200 happy path with mocked client, 400 (empty text), 429 (rate-limit pass-through).
- `web_api/apps/trips/` — new Django app, **stub only**:
  - `models.py` — `Trip(UUIDField id, CharField(64) user_id, label/lat/lon × 3 (current/pickup/dropoff), DecimalField(3,1) cycle_hours_used, CharField status default "pending", DateTimeField created_at auto_now_add)`. `Meta.indexes = [Index(fields=["user_id", "-created_at"])]`.
  - `views.py` — `TripCreateView(CreateAPIView)` (`POST /api/trips/`) and `TripRetrieveView(RetrieveAPIView)` (`GET /api/trips/<uuid:id>/`). Both `permission_classes = [IsAuthenticated]`. Retrieve enforces ownership: `Trip.user_id != request.user_id` → 403.
  - `serializers.py` — request shape mirrors the FE zod schema (three resolved addresses + cycle hours); response includes the new `id`, `status: "pending"`, and `created_at`.
  - `urls.py`, `tests/test_trips.py` (create + retrieve + ownership 401/403/404 + invalid payload 400), `migrations/0001_initial.py` (committed once, never re-edited).
- `web_api/urls.py` — `path("api/geocode/", include("web_api.apps.geocoding.urls"))`, `path("api/trips/", include("web_api.apps.trips.urls"))`.
- `web_api/settings/base.py` — `INSTALLED_APPS` += `"web_api.apps.geocoding"`, `"web_api.apps.trips"`; pydantic-settings field `OPENROUTESERVICE_API_KEY: SecretStr`.
- `pyproject.toml` — add `requests~=2.32.x` (`uv add` resolves the exact version; record in PR body). `types-requests` is already pinned.
- One migration committed; not edited post-apply per `code-standards.md`.

**Tests (mandatory minimum):**

- **Vitest colocated** on every new `.tsx`: `app-shell-layout.test.tsx`, `app-sidebar.test.tsx`, `nav-user.test.tsx`, `address-field.test.tsx`, `cycle-hours-field.test.tsx`, `trip-input-form.test.tsx`, `trips-new.test.tsx`, `trips-detail.test.tsx`.
- **MSW handlers** added to `apps/web-app/src/testing/handlers.ts` covering `/api/geocode/autocomplete/`, `/api/geocode/search/`, `POST /api/trips/`, `GET /api/trips/:id/` — happy path + error states (429, 5xx, 400, 401, 404).
- **Pytest**: `tests/test_openrouteservice_client.py` (mocks `requests.get`, asserts URL, headers, query params, clamps, error mapping), `tests/test_geocoding_views.py`, `tests/test_trips_views.py`.

### Out (deferred, in this order)

- **Spec 04 — ORS Directions + Trip pipeline.** Replace the stub `POST /api/trips/` with a real pipeline: call `/v2/directions/driving-hgv`, persist a `TripRoute` table (polyline + segments + summary), return the route summary. The `/trips/:id` placeholder fills in with a route-summary card. Touches `web_api/integrations/openrouteservice.py` (adds `directions_hgv`), `web_api/apps/trips/` (model upgrade + migration + view), and `apps/web-app/src/features/trip-planner/components/trips-detail-route-card.tsx`.
- **Spec 05 — HOS planner foundation.** Pure-Python `web_api/hos/` module with deterministic `LogEvent` dataclasses; golden tests against `docs/assets/example-complete-grid.png` and the FMCSA paragraphs in `docs/interstate-truck-driver-guide.md`. Pure module, no Django imports.
- **Spec 06 — Map (Leaflet + react-leaflet)** on `/trips/:id` with route polyline + typed stop markers.
- **Spec 07 — Daily Log SVG renderer** (§395.8 grid + Remarks + totals).
- **Spec 08 — PDF export** (client-side `svg2pdf.js` + `jsPDF`).
- **Spec 09 — Saved Trips list + history** in the sidebar (replaces the disabled placeholder).
- Apple OAuth, account settings, i18n, magic-link, MFA — already deferred.

## Prerequisites (already true)

- Specs 01 + 02 are merged on `develop`. `packages/ui` exports primitives + theme + brand components; `apps/web-auth` issues the Clerk session and redirects to `apps/web-app` on success.
- `apps/web-app` already has wired: `<ClerkProvider>`, TanStack Query (`@tanstack/react-query` v5.100.11 with the configured `queryClient`), `<Sonner />` `<Toaster>`, React Router v7.15.1 `createBrowserRouter`, `<RequireAuth>` guard, `apiFetch<T>` helper (`lib/api-client.ts`). **No new frontend runtime deps** beyond the Radix peers the shadcn CLI installs.
- `apps/web-api` has `clerk-backend-api` JWT verification middleware, an `IsAuthenticated` permission, and an `/api/me/` reference view. `web_api/integrations/__init__.py` is a docstring-only package scaffold ready for the new client. `web_api/apps/` is empty (`__init__.py` only).
- `OPENROUTESERVICE_API_KEY` is provisioned (HeiGIT standard free plan: 1000 geocoding req/day, 40 req/min) and placed in `apps/web-api/.env.local` + Fly.io secrets. **Not committed.**
- The OKLCH `@theme` block in `packages/ui/src/styles/globals.css` and the dark-mode class strategy already cover every color used here. This spec does not touch `globals.css`.

## Boundary

- Touches `packages/ui/src/components/ui/` (CLI installs only).
- Touches `apps/web-app/src/{app,components,config,features,testing}/`.
- Touches `apps/web-api/{pyproject.toml,web_api/{settings,urls.py,integrations,apps}}/`.
- Does **not** touch `apps/web-auth/`, `apps/web-api/web_api/hos/`, `apps/web-api/web_api/auth/`, `docs/`, `.github/workflows/`, `.husky/`, `turbo.json`.

## Sequencing

### Step 1 — Backend first (architecture invariant #3 — FE depends on it)

1. `cd apps/web-api && uv add requests` (version verified at write time; pinned via npm-style `~=2.32`).
2. `web_api/integrations/openrouteservice.py` — client + dataclass + error types. Unit-test with `requests` mocked (`responses` or `pytest-httpx`; the latter is already pulled in via test deps). Cite ORS docs in module docstring.
3. `web_api/apps/geocoding/` — Django app skeleton (`apps.py`, `views.py`, `serializers.py`, `urls.py`, `tests/`). Wire into `INSTALLED_APPS` + `urls.py`.
4. `web_api/apps/trips/` — Django app skeleton including `models.py` + `migrations/0001_initial.py`. Wire into `INSTALLED_APPS` + `urls.py`.
5. `web_api/settings/base.py` — add `OPENROUTESERVICE_API_KEY: SecretStr` to the pydantic-settings class.
6. `uv run python manage.py makemigrations trips` produces the migration (committed). `uv run python manage.py migrate` applies it.
7. Green-bar pytest + ruff + mypy + ruff format. Regenerate `apps/web-api/openapi.yaml` via `uv run python manage.py spectacular --file openapi.yaml`.

### Step 2 — shadcn primitives into `packages/ui`

```bash
pnpm dlx shadcn@latest add sidebar sheet dropdown-menu avatar tooltip slider popover command breadcrumb collapsible dialog progress
```

Verify each file lands under `packages/ui/src/components/ui/` (the apps' `components.json` aliases retarget). Confirm Radix peers (`@radix-ui/react-dropdown-menu`, `react-avatar`, `react-tooltip`, `react-slider`, `react-popover`, `react-dialog`, `react-progress`, `react-collapsible`) installed via `packages/ui/package.json`. `cmdk` + `vaul` are the cmdk + drawer peers. Pin each via `npm view <pkg> version`, record resolved versions in the PR body. Cite the shadcn CLI page <https://ui.shadcn.com/docs/cli>. **Do not hand-edit** any file under `components/ui/`.

### Step 3 — App shell

1. Create `components/app-shell/app-shell-layout.tsx` (composes `<SidebarProvider>` + `<AppSidebar>` + sticky header + `<Outlet />`).
2. Create `components/app-shell/app-sidebar.tsx` — single-rail `<Sidebar collapsible="icon">` per shadcn sidebar docs (<https://ui.shadcn.com/docs/components/sidebar>). Header = `<BrandMark>` with `variant="mark-only"` when `state === "collapsed"`. Nav = New Trip + Saved Trips (disabled). Footer = `<NavUser>`.
3. Create `components/app-shell/nav-user.tsx` — `<Avatar>` + `<DropdownMenu>`. Hydration via `useUser()` / `useAuth()` from `@clerk/react`. ThemeToggle row uses the spec-01 `<ThemeToggle>` primitive. Sign out: `await signOut(); navigate(env.VITE_AUTH_SIGN_IN_URL)`.
4. Create `components/app-shell/sidebar-trigger.tsx` — wraps shadcn `<SidebarTrigger>` + global `Cmd/Ctrl+B` binding via a `useEffect` keydown listener.
5. Refactor `app/router.tsx` into nested routes with `<AppShellLayout />` as the parent.
6. Add `app/routes/index-redirect.tsx`, `app/routes/trips-new.tsx` (placeholder import of the form), `app/routes/trips-detail.tsx` (placeholder Skeleton + banner).
7. Extend `config/paths.ts`.

### Step 4 — Trip-input feature (schemas → API → fields → form → routes)

Order matters: schemas are imported by API hooks and field components; API hooks are imported by field components and the form. Build in this order to keep the typecheck graph clean.

1. `features/trip-planner/schemas/trip-input.ts`.
2. `features/trip-planner/api/geocode-autocomplete.ts` (TanStack Query hook).
3. `features/trip-planner/api/plan-trip.ts` (TanStack Query mutation).
4. `features/trip-planner/components/address-field.tsx` (Combobox; cite the shadcn combobox docs <https://ui.shadcn.com/docs/components/combobox>).
5. `features/trip-planner/components/cycle-hours-field.tsx` (Slider + numeric mirror; `Progress` band).
6. `features/trip-planner/components/use-current-location.tsx` (Geolocation API hook + button).
7. `features/trip-planner/components/trip-input-form.tsx` (RHF + zodResolver, FieldGroup composition).
8. Wire into `app/routes/trips-new.tsx`.
9. Fill `app/routes/trips-detail.tsx` with `GET /api/trips/:id/` TanStack Query + the three resolved-address rows.

### Step 5 — Tests

1. MSW handlers in `apps/web-app/src/testing/handlers.ts` for `/api/geocode/autocomplete/`, `/api/geocode/search/`, `POST /api/trips/`, `GET /api/trips/:id/`. Cover happy path + 400 + 401 + 404 + 429 + 5xx.
2. Vitest specs colocated next to each new component. AAA structure. Query order `getByRole > getByLabelText > getByText > getByTestId`. `userEvent` not `fireEvent`.
3. jsdom limitations: if cmdk needs `IntersectionObserver` / `ResizeObserver` shims, add them in `apps/web-app/src/testing/setup.ts` with a citation (mirroring the `localStorage` shim from spec 01 — `progress-tracker.md` "2026-05-19 — Vitest setup ships an in-memory Storage shim").
4. Pytest: `tests/test_openrouteservice_client.py`, `tests/test_geocoding_views.py`, `tests/test_trips_views.py`. Use `factory_boy` for the `Trip` fixture. `@pytest.mark.django_db` on tests that hit the DB.

### Step 6 — Manual browser smoke

Run all three dev servers and walk the golden path on both viewports (mobile 360×640 + desktop 1440×900). Capture screenshots for the PR body.

```bash
# Terminal 1 — backend (DB must be migrated first)
cd apps/web-api && uv run python manage.py migrate && uv run python manage.py runserver 0.0.0.0:8000

# Terminal 2 — web-auth
pnpm --filter web-auth dev

# Terminal 3 — web-app
pnpm --filter web-app dev
```

Browser: open <http://localhost:5173/> → redirected to web-auth sign-in → sign in (use the test creds in `apps/web-auth/README.md`) → bounce back to <http://localhost:5173/trips/new> → land on the app shell → fill three addresses with autocomplete → drag slider to 35.0 → Submit → arrive on `/trips/<uuid>` with the resolved-addresses banner + Skeleton placeholder. Capture: collapsed-sidebar state, expanded-sidebar state, autocomplete dropdown, slider mid-drag, submit loading state, /trips/:id placeholder. Mobile capture: hamburger sheet open, autocomplete dropdown over keyboard, form fits without horizontal scroll.

### Step 7 — Sub-agent passes

Run, in this order, against the diff:

1. `code-reviewer` (`comprehensive-review`) — mandatory.
2. `architect-review` (`comprehensive-review`) — two new Django apps, new BE-FE integration, new storage model.
3. `security-auditor` (`comprehensive-review`) — ORS proxy attack surface (input validation, header allowlist, SSRF impossibility, JWT enforcement, rate-limit forwarding).
4. `ui-visual-validator` (`accessibility-compliance`) — Combobox + Slider + Sidebar + DropdownMenu; WCAG 2.5.5 / 2.5.8 target sizes, 2.1.1 keyboard reachability, 4.1.2 name/role/value, 1.4.3 contrast.
5. `performance-optimizer` (`application-performance`) — new routes + new TanStack Query fetches + autocomplete debounce + bundle size delta.

Resolve every CRITICAL before merge. Defer L1/M findings as open questions only with a written justification.

### Step 8 — Tracker + architecture updates (the last files committed)

- `context/progress-tracker.md` — record completion, reshuffle Next Up (HOS planner → spec 05; new spec 04 = ORS Directions; spec 02 follow-ups stay queued).
- `context/architecture.md#Storage Model` — add `trips` table description (UUID id, user_id index, cycle_hours_used Decimal, status enum).
- `apps/web-api/openapi.yaml` — regenerated via `drf-spectacular` (one-shot management command output; do not hand-edit).

## File-level deliverables

```
apps/web-api/
├── pyproject.toml                                          # MODIFY: + requests
├── openapi.yaml                                            # REGENERATE (drf-spectacular)
└── web_api/
    ├── settings/base.py                                    # MODIFY: + OPENROUTESERVICE_API_KEY, + INSTALLED_APPS
    ├── urls.py                                             # MODIFY: + include geocoding + trips
    ├── integrations/
    │   └── openrouteservice.py                             # NEW
    └── apps/
        ├── geocoding/
        │   ├── __init__.py                                 # NEW
        │   ├── apps.py                                     # NEW
        │   ├── serializers.py                              # NEW
        │   ├── urls.py                                     # NEW
        │   ├── views.py                                    # NEW
        │   └── tests/
        │       ├── __init__.py                             # NEW
        │       └── test_geocoding.py                       # NEW
        └── trips/
            ├── __init__.py                                 # NEW
            ├── apps.py                                     # NEW
            ├── models.py                                   # NEW
            ├── serializers.py                              # NEW
            ├── urls.py                                     # NEW
            ├── views.py                                    # NEW
            ├── migrations/
            │   ├── __init__.py                             # NEW
            │   └── 0001_initial.py                         # NEW (generated)
            └── tests/
                ├── __init__.py                             # NEW
                └── test_trips.py                           # NEW

apps/web-app/src/
├── config/paths.ts                                         # MODIFY: + tripsNew, tripsDetail(id)
├── app/
│   ├── router.tsx                                          # REWRITE: nested routes under <AppShellLayout>
│   └── routes/
│       ├── index-redirect.tsx                              # NEW
│       ├── trips-new.tsx                                   # NEW (+ test)
│       └── trips-detail.tsx                                # NEW (+ test)
├── components/
│   └── app-shell/
│       ├── app-shell-layout.tsx                            # NEW (+ test)
│       ├── app-sidebar.tsx                                 # NEW (+ test)
│       ├── nav-user.tsx                                    # NEW (+ test)
│       └── sidebar-trigger.tsx                             # NEW
├── features/trip-planner/
│   ├── api/
│   │   ├── geocode-autocomplete.ts                         # NEW
│   │   └── plan-trip.ts                                    # NEW
│   ├── components/
│   │   ├── address-field.tsx                               # NEW (+ test)
│   │   ├── cycle-hours-field.tsx                           # NEW (+ test)
│   │   ├── trip-input-form.tsx                             # NEW (+ test)
│   │   └── use-current-location.tsx                        # NEW
│   └── schemas/
│       └── trip-input.ts                                   # NEW
└── testing/
    └── handlers.ts                                         # MODIFY: + /api/geocode/* + /api/trips/*

packages/ui/src/components/ui/                              # CLI-OWNED — do not hand-edit
├── avatar.tsx                                              # NEW (via shadcn add)
├── breadcrumb.tsx                                          # NEW
├── collapsible.tsx                                         # NEW
├── command.tsx                                             # NEW
├── dialog.tsx                                              # NEW
├── dropdown-menu.tsx                                       # NEW
├── popover.tsx                                             # NEW
├── progress.tsx                                            # NEW
├── sheet.tsx                                               # NEW
├── sidebar.tsx                                             # NEW
├── slider.tsx                                              # NEW
└── tooltip.tsx                                             # NEW

context/
├── architecture.md                                         # MODIFY: + trips table in Storage Model
└── progress-tracker.md                                     # MODIFY: completion + Next Up reshuffle
```

No barrel files anywhere. `packages/ui/package.json#exports`'s pattern key (`./components/*` → `./src/components/*.tsx`) already covers the new `ui/*` files automatically.

## Existing functions / utilities to reuse (do not re-implement)

- `apiFetch<T>(path, { token })` at `apps/web-app/src/lib/api-client.ts` — every BE call.
- `queryClient` at `apps/web-app/src/lib/query-client.ts` — already mounted in `provider.tsx`.
- `<RequireAuth>` at `apps/web-app/src/components/require-auth.tsx` — wrap protected routes here, not at the component level.
- `cn()` at `@outbound/ui/lib/utils`.
- `<ThemeToggle>`, `useTheme`, `<BrandMark>`, `<SpotterLoader>` from `@outbound/ui/components/{theme,brand}/*`.
- `<Toaster>` is already mounted in `provider.tsx`; `import { toast } from "sonner"` for transient errors.
- Clerk Core 3 hooks: `useUser()`, `useAuth()`. `useAuth().signOut()` for sign-out. **Not `<UserButton />`.**
- DRF auth pattern from `web_api/auth/` — `IsAuthenticated` + `request.user_id`.
- pydantic-settings `Settings` in `web_api/settings/base.py` for env config — not `os.environ`.

## Architecture invariants verified

- **#1 (HOS planner pure Python)** — untouched.
- **#3 (no raw ORS calls from browser)** — ORS API key never leaves `web_api/integrations/openrouteservice.py`. Frontend only ever hits `/api/geocode/*` + `/api/trips/*`.
- **#4 (no client-side HOS math)** — spec 03 ships zero HOS code; cycle-hours is captured and persisted, not computed against.
- **#5 (ownership-checked mutations)** — `Trip.user_id == request.user_id` enforced in retrieve; create stamps `user_id = request.user_id` server-side (the FE never sends it).
- **#7 (theme tokens only)** — every color via semantic Tailwind utilities (`bg-primary`, `text-muted-foreground`, etc.). No hex literals. `react-doctor` audit gates.

## Sub-agents to invoke

| Agent (plugin)                                      | When                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `code-reviewer` (`comprehensive-review`)            | Mandatory before PR.                                                        |
| `architect-review` (`comprehensive-review`)         | Required — new Django apps + new BE-FE integration + new storage model.     |
| `security-auditor` (`comprehensive-review`)         | Required — new ORS proxy = new attack surface.                              |
| `ui-visual-validator` (`accessibility-compliance`)  | Required — new interactive UI (Combobox + Slider + Sidebar + DropdownMenu). |
| `performance-optimizer` (`application-performance`) | Required — new routes + new TanStack Query fetches + autocomplete debounce. |
| `typescript-pro` (`javascript-typescript`)          | Recommended — RHF + zod resolver + discriminated unions for address state.  |
| `python-pro` + `django-pro` (`python-development`)  | Recommended — new Django apps, ORM, ViewSets, migrations.                   |

Auto-trigger: `react-architecture`, `react-doctor` (every `.tsx`), `shadcn` (during install + composition), `django-expert` (every `.py` under `apps/web-api/`).

## Citations to include inline (or in PR body)

- shadcn CLI: <https://ui.shadcn.com/docs/cli>
- shadcn Sidebar primitive: <https://ui.shadcn.com/docs/components/sidebar>
- shadcn sidebar-09 (reference, not copied verbatim): <https://ui.shadcn.com/view/new-york-v4/sidebar-09>
- shadcn Combobox (Command + Popover): <https://ui.shadcn.com/docs/components/combobox>
- shadcn Slider: <https://ui.shadcn.com/docs/components/slider>
- shadcn DropdownMenu: <https://ui.shadcn.com/docs/components/dropdown-menu>
- shadcn Avatar: <https://ui.shadcn.com/docs/components/avatar>
- shadcn Empty + Skeleton (already installed): <https://ui.shadcn.com/docs/components/skeleton>
- React Router 7 nested routes: <https://reactrouter.com/start/data>
- TanStack Query v5: <https://tanstack.com/query/v5/docs/framework/react/overview>
- React Hook Form + zod resolver: <https://react-hook-form.com/get-started#SchemaValidation>
- ORS Pelias geocoder docs: <https://giscience.github.io/openrouteservice/api-reference/endpoints/geocoder/>
- Pelias `/search` spec: <https://github.com/pelias/documentation/blob/master/search.md>
- Pelias `/autocomplete` spec: <https://github.com/pelias/documentation/blob/master/autocomplete.md>
- Clerk Core 3 useUser / useAuth: <https://clerk.com/docs/references/react/use-user>, <https://clerk.com/docs/references/react/use-auth>
- WCAG 2.5.5 (Target Size — Enhanced, 44×44): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced>
- WCAG 2.5.8 (Target Size — Minimum, 24×24): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum>
- W3C ARIA APG Combobox pattern: <https://www.w3.org/WAI/ARIA/apg/patterns/combobox/>
- DRF APIView + permissions: <https://www.django-rest-framework.org/api-guide/permissions/>
- drf-spectacular schema generation: <https://drf-spectacular.readthedocs.io>
- Architecture invariants verified against: `context/architecture.md`
- UI patterns derived from: `/Users/mateo/Documents/Winter/Summer/Spotter/Outbound/UI.md` (§2 app shell, §3.1 trip-input card, §7 forms, §9 mobile, §10 density, §13 components inventory)

Third-party versions verified at PR-write time via `npm view <pkg> version` and `uv add <pkg>`; resolved versions recorded in the PR body.

## Verification (the unit is not done until every box is ticked)

- [ ] `pnpm exec turbo run lint typecheck test build --filter=web-app --filter=@outbound/ui` is green.
- [ ] `pnpm format:check` is green.
- [ ] `cd apps/web-api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest` is green.
- [ ] CI grep enforcing `web_api/hos/` purity passes (no Django imports introduced inside `hos/`).
- [ ] No hex literals or raw `bg-*-500`-style Tailwind colors in any file under `apps/web-app/src/{components,features}/`. Semantic tokens only.
- [ ] `react-doctor` audit shows zero new regressions.
- [ ] Manual browser smoke on **mobile 360×640 + desktop 1440×900**: sign-in → `/trips/new` → fill three addresses with autocomplete → drag slider to 35h → submit → land on `/trips/:id` with the resolved-labels banner + Skeleton. Screenshots in PR body.
- [ ] Sidebar collapses to icon-rail on `Cmd+B` / `Ctrl+B`. Mobile renders as a `Sheet`. Profile dropdown opens; ThemeToggle inside it works; Sign out works.
- [ ] Autocomplete reachable via keyboard (Tab into field → ArrowDown / ArrowUp to navigate → Enter to select → Esc to dismiss). Verified manually + by Vitest spec.
- [ ] `code-reviewer`, `architect-review`, `security-auditor`, `ui-visual-validator`, `performance-optimizer` have reviewed; no unresolved CRITICAL findings.
- [ ] Branch `feat/03-trip-input-foundation`; PR base `develop`.
- [ ] `.github/pull_request_template.md` filled verbatim; Conventional Commit subjects; no `Co-Authored-By` trailer; no `--no-verify`.
- [ ] `context/architecture.md#Storage Model` updated with the new `trips` table; matches the migration.
- [ ] `apps/web-api/openapi.yaml` regenerated and committed.
- [ ] `context/progress-tracker.md` updated as the **last** committed file — spec 03 → Completed; Next Up reshuffled (spec 04 = ORS Directions, spec 05 = HOS planner foundation).

## Out of scope (deliberate — don't touch in this unit)

- ORS `/v2/directions/driving-hgv` integration → spec 04.
- HOS planner module + golden tests → spec 05.
- Leaflet + react-leaflet map → spec 06.
- ELD Daily Log SVG renderer → spec 07.
- PDF export → spec 08.
- Saved Trips list (the disabled sidebar item) → spec 09.
- Apple OAuth, account settings, i18n, magic-link sign-in, MFA — already deferred.
- Personal conveyance, yard moves, sleeper-berth pairing, 60/7 schedule — out of v1 (`project-overview.md#Out of Scope`).
- `web-auth` cosmetic changes, `web-api/auth/` middleware tweaks, CI workflow edits.

## Open questions

None at write time. Three known-unknowns to document if hit during implementation (not blockers):

- If `shadcn add sidebar` bundles a different set of sub-components than expected, document the delta in the PR body and only update `packages/ui/package.json#exports` if the existing pattern key doesn't resolve the new files.
- If Pelias `/geocode/autocomplete` returns features without `lat`/`lon` (a known Pelias quirk for some `layer` types), the client falls back to `/geocode/search` on selection to resolve coordinates; document the fallback path.
- If Vitest jsdom trips on `IntersectionObserver` / `ResizeObserver` for cmdk, add shims to `apps/web-app/src/testing/setup.ts` (mirroring spec 01's `localStorage` shim) and cite the cmdk issue tracker.

Log any survivor questions in `context/progress-tracker.md#Open Questions` before opening the PR.
