# 09 — Saved Trips: list, open, delete (Clerk-scoped)

> Closes success criterion #5 from `context/project-overview.md` — "Trips persist per user; a refresh restores the same trip from saved history." Two thin DRF endpoints (`GET /api/trips/`, `DELETE /api/trips/<uuid:id>/`) sit on top of the data model already in place (Clerk `user_id` indexed `(user_id, -created_at)` since spec 04; FK cascades on `TripStop` / `LogEvent` / `LogDay` since spec 06). A new `/trips` route in `apps/web-app` renders a shadcn DataTable over those endpoints with row-click open, paginated via DRF's `LimitOffsetPagination`, plus an `AlertDialog` confirm for delete. The sidebar gains a "Saved trips" item that remains keyboard-reachable in `data-collapsible="icon"` mode. Zero schema migrations: the indexes and cascades exist already; this spec is two new view classes, one new feature folder, and two new shadcn primitives. PDF export ships as a sibling spec (Spec 10). Internal scope splits into Unit 9.1 (BE) and Unit 9.2 (FE) — see decision 20 for the one-PR-vs-two rationale.

## Goal

After this spec ships, a signed-in driver who has planned trips lands at `/trips`, sees a paginated table ordered newest-first, opens a saved trip by clicking its row (loads instantly from the persisted plan — no replan), and deletes a trip with a confirm step. The sidebar nav exposes the route from anywhere in the app shell. The persistence success criterion is closed; combined with Spec 10 (PDF export), the assessment-readiness checklist in `context/project-overview.md` is satisfied.

Five user-visible additions:

1. **New `/trips` route** — shadcn DataTable (`@tanstack/react-table` v8 + shadcn `table` primitive) with five columns: Route (`current → pickup → dropoff`, truncated), Distance, Days, Departs, Created (relative). Newest-first; 50 rows per page (DRF `LimitOffsetPagination`); footer "Page X of Y" + Prev/Next. Loading skeleton, error retry, empty state.
2. **Sidebar "Saved trips" nav item** — `lucide-react` `Route` icon. Mounted in `app-sidebar.tsx` between the existing "Plan trip" entry and `NavUser`. `SidebarMenuButton` natively handles `data-collapsible="icon"` — when the rail is collapsed, only the icon shows with the tooltip surfacing the label. Active when `pathname === "/trips"`.
3. **Open trip via row click** — `navigate(`/trips/${id}`)`. The detail route already exists (spec 07) and rehydrates via `useTripPlan` against the persisted plan; no replan, no ORS call.
4. **Delete with AlertDialog confirm** — destructive copy ("This will permanently delete this trip and its log entries. This cannot be undone."). Confirm button is `variant="destructive"`. `sonner` toast on success ("Trip deleted"); list query invalidated; row disappears in place.
5. **Empty state** — shadcn `Empty` with "No saved trips yet. Plan your first one." and a `Button` linking to `/trips/new`. Renders when the list is empty AND `isLoading === false`.

Architecture invariants from `context/architecture.md` hold:

- **#1 (HOS planner pure)** — zero touch on `web_api/hos/**`; the spec-05 boundary test passes verbatim.
- **#4 (no client-side HOS math)** — FE renders persisted rows from spec 06 only; no client-side timing or status decisions.
- **#5 (ownership)** — both new endpoints filter `Trip.objects.filter(user_id=request.user_id)`. Foreign trip → 404 (no oracle; matches spec 04 `TripRetrieveView` precedent).
- **#6 (PDF client-only)** — N/A this spec (Spec 10 owns it).
- **#7 (theme tokens only)** — table chrome, icons, dialog all resolve from `@theme inline` tokens; the colocated test asserts no hex literals.
- **#8 (no custom sub-agents)** — reviews use the wshobson marketplace agents already declared in `.claude/settings.json`.
- **#9 (specs drive implementation)** — this file is the source of truth; `context/progress-tracker.md#Next Up` is updated to point here.

## Decisions of record (resolved at planning time)

Pre-resolved during the spec-09 planning session. Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-flickering-prism.md`. The decisions are split BE-first (decisions 1–9) then FE (decisions 10–19) then scope (decision 20).

### Backend

1. **Thin list serializer** — `TripListItemSerializer` returns only `{id, current_label, pickup_label, dropoff_label, route_summary, days_count, start_at, created_at}`. Polyline, segments, stops, events, route_segments are **not** in the list payload. The detail route (`/trips/<uuid>`) re-fetches the full plan via the existing `useTripPlan` query (key `["trip", tripId, "plan"]`) — the cache de-dupes across navigations. Saves ~95% of the payload size on the list call (a 5-day trip's plan envelope is ~20 KB compressed; the list item is ~300 bytes).

2. **`days_count` computed via DB annotation, not stored.** New `Trip.objects` manager uses `.annotate(days_count=Count("log_days", distinct=True))`. Single SQL query: a `LEFT JOIN log_days` with `GROUP BY trip.id`. The `(trip, date)` index on `log_days` supports the join. Confirmed via `EXPLAIN`-style review in test; a future spec can denormalize to a `Trip.days_count` column if list pages routinely exceed ~50 trips per user, but the JOIN cost is trivial at the v1 scale (default page = 50 trips × 7 joined log_days = 350 grouped rows). Documented in the serializer module docstring.

3. **`route_summary` field** is a passthrough from `Trip.route_summary` (already JSONField, populated by spec 04's `services.plan_trip`). Shape: `{distance_mi: float, duration_s: int}`. The serializer adds no transformation.

4. **List endpoint: `TripListView(ListAPIView)`** at `GET /api/trips/`. `IsAuthenticated`. `get_queryset` filters on `request.user_id` (via the existing `_request_user_id` helper from spec 06) AND orders by `(-created_at)`. Pagination uses the project-wide `LimitOffsetPagination` (`PAGE_SIZE=50`, max 200 — confirm in `web_api/settings/base.py`). Throttle scope `trip_list = 60/min`. Cite https://www.django-rest-framework.org/api-guide/generic-views/#listapiview.

5. **Destroy endpoint: `TripDestroyView(DestroyAPIView)`** at `DELETE /api/trips/<uuid:id>/`. `IsAuthenticated`. Same `get_queryset` ownership filter so a foreign-or-missing UUID surfaces as 404 (no oracle — `Http404` from `get_object()` is the DRF default when the queryset filter excludes the row; matches spec 04 `TripRetrieveView` precedent and spec 06 `TripPlanView.get_queryset` shape). Cascade is guaranteed by spec 06's `on_delete=CASCADE` FKs on `TripStop` / `LogEvent` / `LogDay`. Returns 204 with empty body (DRF default). Throttle scope `trip_delete = 20/min`. Cite https://www.django-rest-framework.org/api-guide/generic-views/#destroyapiview.

6. **No soft-delete in v1.** Cascading hard delete via the FKs. Reasoning: assessment scope, no admin role, no recovery story, no audit log. The DELETE is destructive and the AlertDialog warns explicitly. Re-plan recreates the trip from the same form values if needed. A future spec can introduce a `Trip.deleted_at` column + a "Trash" view; v1 punts.

7. **Throttle scopes added to `DEFAULT_THROTTLE_RATES`** in `web_api/settings/base.py`: `trip_list = 60/min`, `trip_delete = 20/min`. Both keyed on `request.user_id` via the existing `PerUserScopedThrottle` (no new throttle class). Rate rationale: a saved-trips browser polling once per minute on tab focus stays under 60/min; delete is destructive and bursty deletes are an anti-pattern. Caps remain comfortably under the HeiGIT free-tier ORS quota since neither endpoint hits ORS.

8. **No new migration.** The `(user_id, -created_at)` index exists from spec 04 `Trip.Meta.indexes`. `Trip.route_summary` JSONField exists from spec 04. `LogDay` table + cascade FK exist from spec 06. Verified by reading `apps/web-api/web_api/apps/trips/models.py` before authoring the views.

9. **Tests** (`apps/web-api/tests/apps/trips/`):
   - `test_views_list.py` — returns only owned trips (creates 3 owned + 2 foreign via `TripFactory`, asserts only the 3 own ones surface in `results`); ordered `(-created_at)` (creates trips with `created_at` offsets via factory + `freezegun` or `time_machine`); paginated correctly (creates 60 trips, asserts page 1 has 50 + `next`, page 2 has 10 + `previous`); `days_count` annotation matches `LogDay` count (factory adds 3 `LogDayFactory` rows per trip; serializer reports 3); requires auth (401 unauthenticated); throttled at 60/min (uses `freezegun` to burn the cache window). Use `@pytest.mark.django_db` + `TripFactory` + `LogDayFactory` (confirm `apps/web-api/tests/factories.py` has both — if `LogDayFactory` doesn't exist, add it as part of this spec).
   - `test_views_destroy.py` — 204 on owned trip + row removed from DB + cascade verified (TripStop/LogEvent/LogDay also gone); 404 on missing UUID; 404 on foreign trip (NOT 403 — no oracle); 401 unauthenticated; throttled at 20/min.
   - `test_throttles.py` (extend the existing file from spec 04) — assert `PerUserScopedThrottle` resolves `trip_list` and `trip_delete` scopes correctly.

### Frontend

10. **shadcn DataTable composition.** Install two primitives via `pnpx shadcn@latest add table alert-dialog` into `packages/ui` (the shared UI source of truth per `CLAUDE.md`). Add `@tanstack/react-table@8` to `apps/web-app/package.json` only (it's the peer of the shadcn DataTable example; verified version via `npm view @tanstack/react-table version` → `8.21.3` on 2026-05-21). Cite the shadcn DataTable composition pattern: https://ui.shadcn.com/docs/components/data-table.

11. **Per spec 08 amendment 2: install via `npx -y shadcn@latest`, not `pnpm dlx`.** `pnpm dlx shadcn@latest add table alert-dialog` silently truncated CLI output in spec 08; `npx -y shadcn@latest` worked first try. Run from `packages/ui`. Confirm `packages/ui/src/components/ui/{table.tsx, alert-dialog.tsx}` land; do NOT hand-edit per `context/code-standards.md`. Confirm `packages/ui/package.json#exports` resolves both via the existing `./components/*` pattern key.

12. **Feature folder layout** — new `apps/web-app/src/features/saved-trips/` per Bulletproof, with:
    - `api/list-trips.ts` — `useTripList(params)` → `useQuery({ queryKey: ["trips", "list", params], staleTime: 60_000, retry: 1 })`. Returns the DRF pagination envelope `{count, next, previous, results}`. `params = { limit, offset }`.
    - `api/delete-trip.ts` — `useDeleteTrip()` → `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips", "list"] }), onError })`. `onError` shows `sonner.toast.error("Couldn't delete trip")`.
    - `schemas/saved-trip.ts` — zod schema for the `TripListItemSerializer` output; types exported from there. `z.coerce.number()` for the decimal-string `distance_mi`. ISO 8601 for timestamps via `z.iso.datetime({ offset: true })` (v4 API; matches spec 06 precedent).
    - `schemas/trips-list-response.ts` — zod schema for the pagination envelope.
    - `components/saved-trips-table.tsx` — composed from `@tanstack/react-table` + shadcn `table`. `columns: ColumnDef<SavedTrip>[]` const declared inline (per decision 14). Row `onClick` navigates to `/trips/<id>`.
    - `components/delete-trip-dialog.tsx` — shadcn `AlertDialog` per decision 16.
    - `components/saved-trips-empty.tsx` — shadcn `Empty` per decision 17.
    - `components/saved-trips-pagination.tsx` — Prev/Next + page label per decision 15.

13. **Open-trip flow is `navigate(`/trips/${id}`)`, no new URL.** The route already exists from spec 07. The detail route already lazy-loads the persisted plan via `useTripPlan` (TanStack query key `["trip", tripId, "plan"]`); the cache holds for 5 minutes per spec 07's `staleTime`. No replan, no ORS call, no map re-render. Row click handler uses `useNavigate()`; row keyboard handler is `onKeyDown` checking `Enter` / `Space` per WCAG 2.1.1.

14. **Column definitions** live inline in `saved-trips-table.tsx` as a `columns: ColumnDef<SavedTrip>[]` const (NOT a separate `columns.ts` file — too small to extract, follows the shadcn DataTable example shape verbatim). Five columns:
    - **Route** — `cell: ({ row }) => <RouteCell trip={row.original} />` rendering `current_label → pickup_label → dropoff_label` with `truncate` on each (per `context/code-standards.md` "Styling: truncate instead of overflow-hidden text-ellipsis whitespace-nowrap"). `lucide-react` `ArrowRight` (size-3) separators with `data-icon` slot.
    - **Distance** — `cell: ({ row }) => formatDistance(row.original.route_summary.distance_mi)` reusing the existing util at `apps/web-app/src/features/trip-planner/utils/format-distance.ts`.
    - **Days** — `cell: ({ row }) => row.original.days_count` (raw number).
    - **Departs** — `cell: ({ row }) => formatStartAt(row.original.start_at, plan.home_terminal_tz)` reusing the existing util at `apps/web-app/src/features/trip-planner/utils/format-start-at.ts`. Default `America/New_York` if no plan context (saved-trips list has no plan envelope — uses the default fallback per spec 06).
    - **Actions** — `cell: ({ row }) => <DeleteTripButton trip={row.original} />`. Trash icon button (`variant="ghost" size="icon"`); `data-icon` slot for the `lucide-react` `Trash2`. Click opens the AlertDialog; `e.stopPropagation()` so the row click doesn't fire.
      No sorting handles in v1 (server is `(-created_at)` only). Header text is plain — no `<button>` chrome around column names.

15. **Pagination footer.** Renders below the table: "Page X of Y" + Prev / Next buttons. Disabled state when `previous === null` / `next === null`. The component reads page state from `@tanstack/react-table`'s `getPageCount()` and `getState().pagination.pageIndex` BUT the table is in `manualPagination: true` mode — server controls page boundaries via `LimitOffsetPagination` (the FE sends `limit=50&offset=N*50`). The `pageCount` total comes from `Math.ceil(envelope.count / 50)`. `previousPage` / `nextPage` callbacks update local `[pagination, setPagination]` state which feeds into the `useTripList(params)` key; TanStack refetches on key change automatically. No page-size selector in v1.

16. **AlertDialog copy + UX.** Title: "Delete this trip?". Description: "This will permanently delete the trip and all of its log entries. This cannot be undone." Confirm button: `variant="destructive"`, label "Delete". Cancel button: `variant="outline"`, label "Cancel". Focus auto-returns to the trash button on close (shadcn `AlertDialog` defaults). `aria-describedby` chain wires Description → trigger. Toast on success: `sonner.toast.success("Trip deleted")`. Cite https://ui.shadcn.com/docs/components/alert-dialog.

17. **Empty state** uses shadcn `Empty` (already in `packages/ui`). Renders when `data?.results.length === 0 && !isLoading`. Copy: "No saved trips yet." Description: "Plan your first trip to see it here." Action: `<Button asChild><Link to="/trips/new">Plan a trip</Link></Button>`.

18. **Loading and error states.**
    - Loading: ten Skeleton rows matching the visible column count (renders inside `<TableBody>` so the table layout doesn't shift between loading and loaded).
    - Error: shadcn `Empty` with destructive variant, copy "Couldn't load trips.", description "Check your connection and try again.", action button "Retry" calling `refetch()` from the query result.

19. **Sidebar nav integration in `apps/web-app/src/components/app-shell/app-sidebar.tsx`.** Adds one `SidebarMenuItem` with `SidebarMenuButton` to the existing `SidebarMenu` that already holds the "Plan trip" entry from spec 03. New entry's icon is `lucide-react` `Route`; label "Saved trips". Active state via `data-active={pathname.startsWith("/trips") && pathname !== "/trips/new"}` so the highlight survives both the list and detail routes. Per `context/ui-context.md#Spotter logo loader` and `SidebarMenuButton`'s native API, the collapsed-mode (icon-only) tooltip is the same label string — no custom tooltip wiring needed. The MSW handler doesn't matter for the sidebar (no data fetch); the active-state test exercises the routing.

### Scope split

20. **Internal split: Unit 9.1 (BE) → Unit 9.2 (FE), single PR by default.** Per `context/ai-workflow-rules.md`: "Split if the unit currently combines: UI changes AND database changes". This spec touches BE (two views) AND FE (table + dialog + route + sidebar) but adds **zero schema migrations** — the storage layer is unchanged. The split rule's stricter trigger is "more than one verification path that someone would manually click through"; for this spec the single verification is end-to-end (sign in → plan a trip → navigate to `/trips` → open it → delete it → confirm gone) which traverses both halves. The BE half is small enough (~250 LOC including tests) that splitting into two PRs would add review overhead without isolating risk. **Default: one PR with two internal units (9.1 BE first commit, 9.2 FE second commit), one branch, one verification walk.** If during implementation the FE blocks (e.g., shadcn install hiccup, react-table API surprise), Unit 9.1 ships alone first as `feat/09-saved-trips-be` and Unit 9.2 follows as `feat/09-saved-trips-fe`. This is the same internal-split discipline spec 06 followed (3.5 BE + 3.5 FE in one branch).

## Scope

### In

**`apps/web-api` — BE (Unit 9.1):**

- `web_api/apps/trips/views.py` (MODIFY) — add `TripListView(ListAPIView)` + `TripDestroyView(DestroyAPIView)`. Both use `_request_user_id` ownership filter + `PerUserScopedThrottle`. Reuse the existing `IsAuthenticated` permission.
- `web_api/apps/trips/serializers.py` (MODIFY) — add `TripListItemSerializer` returning the thin shape per decision 1.
- `web_api/apps/trips/urls.py` (MODIFY) — add `path("", TripListView.as_view(), name="trip-list")` and `path("<uuid:id>/", TripDestroyView.as_view(), name="trip-destroy")`. The existing `<uuid:id>/plan/` and `<uuid:id>/` (retrieve) routes stay; URL routing precedence has `<uuid:id>/` matching the retrieve GET and the destroy DELETE on the same path (HTTP verb dispatch via DRF generic view internals). **If `TripRetrieveView` is currently `RetrieveAPIView` on `<uuid:id>/`, promote it to `RetrieveDestroyAPIView` instead of adding a sibling DestroyView** — single class is cleaner. Verify the existing class shape during implementation; the spec keeps both options open since the existing retrieve view's name (`TripRetrieveView` vs. promote-in-place) is an implementation detail.
- `web_api/settings/base.py` (MODIFY) — add `trip_list = 60/min`, `trip_delete = 20/min` to `DEFAULT_THROTTLE_RATES`.
- `web_api/apps/trips/managers.py` (NEW, optional) — `TripManager.with_days_count()` returning `.annotate(days_count=Count("log_days", distinct=True))`. Optional because the annotation can also live inline in `TripListView.get_queryset` — implementer's call. Recommended: manager method since spec 11+ (saved-trips search/filter) will reuse the annotation.
- `apps/web-api/tests/apps/trips/test_views_list.py` (NEW) per decision 9.
- `apps/web-api/tests/apps/trips/test_views_destroy.py` (NEW) per decision 9.
- `apps/web-api/tests/apps/trips/test_throttles.py` (MODIFY if it exists from spec 04; NEW otherwise) — add scope coverage for the two new rates.
- `apps/web-api/tests/factories.py` (MODIFY if `LogDayFactory` missing) — `factory_boy` factory matching the spec 06 schema.

**`packages/ui` — two shadcn primitives:**

- `packages/ui/src/components/ui/table.tsx` (NEW via shadcn CLI per decision 11). Components: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`.
- `packages/ui/src/components/ui/alert-dialog.tsx` (NEW via shadcn CLI per decision 11). Components: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`.
- `packages/ui/package.json` — may add `@radix-ui/react-alert-dialog` to runtime deps (table is pure shadcn primitives, no Radix peer); verify pinned version via `pnpm view @radix-ui/react-alert-dialog version` at install time and record in PR body.

**`apps/web-app` — new feature `features/saved-trips/**` + route + sidebar (Unit 9.2):\*\*

- `apps/web-app/package.json` (MODIFY) — add `@tanstack/react-table@^8.21.3` to dependencies.
- `apps/web-app/src/features/saved-trips/api/list-trips.ts` (NEW) per decision 12.
- `apps/web-app/src/features/saved-trips/api/list-trips.test.ts` (NEW) — assert query key shape, pagination params plumbing, error envelope.
- `apps/web-app/src/features/saved-trips/api/delete-trip.ts` (NEW) per decision 12.
- `apps/web-app/src/features/saved-trips/api/delete-trip.test.ts` (NEW) — assert mutationFn shape, invalidation key, error toast.
- `apps/web-app/src/features/saved-trips/schemas/saved-trip.ts` (NEW) — zod schema + types.
- `apps/web-app/src/features/saved-trips/schemas/saved-trip.test.ts` (NEW) — parse fixture, reject malformed shapes.
- `apps/web-app/src/features/saved-trips/schemas/trips-list-response.ts` (NEW) — pagination envelope zod schema.
- `apps/web-app/src/features/saved-trips/components/saved-trips-table.tsx` (NEW) per decisions 14 + 15.
- `apps/web-app/src/features/saved-trips/components/saved-trips-table.test.tsx` (NEW) — renders 3-row fixture; row click navigates; pagination Next/Prev disable correctly; loading shows skeletons; empty state renders when count=0.
- `apps/web-app/src/features/saved-trips/components/delete-trip-dialog.tsx` (NEW) per decision 16.
- `apps/web-app/src/features/saved-trips/components/delete-trip-dialog.test.tsx` (NEW) — opens on trigger; cancel closes; confirm fires mutation + toast; AlertDialogTitle + AlertDialogDescription present (a11y).
- `apps/web-app/src/features/saved-trips/components/saved-trips-empty.tsx` (NEW) per decision 17.
- `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.tsx` (NEW) per decision 15.
- `apps/web-app/src/app/routes/trips-history.tsx` (NEW) — wraps `<RequireAuth>` + `<Suspense fallback={<SpotterLoader size="lg" />}>`. Mounts `<SavedTripsTable />`. Page title "Saved trips".
- `apps/web-app/src/app/routes/trips-history.test.tsx` (NEW) — renders RequireAuth gate; auth redirect; empty / loading / error states; full table render against the MSW fixture.
- `apps/web-app/src/app/router.tsx` (MODIFY) — add `{ path: "trips", element: <TripsHistoryRoute /> }` inside the existing authenticated layout block. The existing `/trips/:id` route stays untouched.
- `apps/web-app/src/components/app-shell/app-sidebar.tsx` (MODIFY) — add the "Saved trips" `SidebarMenuItem` per decision 19.
- `apps/web-app/src/components/app-shell/app-sidebar.test.tsx` (MODIFY if exists; NEW otherwise) — assert the new nav item renders; active-state via `data-active` matches the current pathname; tooltip surfaces label when collapsed.
- `apps/web-app/src/testing/handlers.ts` (MODIFY) — add `GET /api/trips/` returning a 3-trip fixture (renamed `mockSavedTripsList` + a `mockSavedTripsListEmpty` variant); `DELETE /api/trips/<uuid>` returning 204.
- `apps/web-app/eslint.config.js` (MODIFY) — add `features/saved-trips` to the existing feature-allowlist carve-out (one-line edit; mirrors spec 03 + 08 pattern). One-way import from `saved-trips → trip-planner` (for `formatDistance`, `formatStartAt`, possibly the `useTripPlan` query key constants) is allowed; reverse direction stays blocked.

### Out (deferred to listed specs)

- **PDF export** → Spec 10. Sibling spec authored in the same planning turn.
- **Reverse-geocoded city/state in `current_label` / `pickup_label` / `dropoff_label`** → Spec 11 (driver profile + reverse geocode).
- **Driver Profile model (per-Clerk-user defaults for truck/carrier/address/co-driver)** → Spec 11.
- **Trip re-planning (`POST /api/trips/<id>/replan/` + `trip_route_versions` table)** → future spec (architecture.md already pre-designs this).
- **Search / filter / sort beyond `-created_at`** → future, on driver demand.
- **Bulk delete** → future, on driver demand.
- **Per-trip thumbnails (mini-map preview in row)** → future, considered too cost-heavy for v1 (one Leaflet snapshot per row).
- **Soft-delete / trash bin / restore** → not planned in v1 scope.
- **Multi-user trip sharing** → not planned (architecture has no share model).
- **Trip export (JSON / GPX) beyond PDF** → not planned.
- **`/trips` deep-linking to a filtered view (`?from=…&to=…`)** → future, tied to the filter spec.
- **Empty-state CTA variants (e.g., "Import from another tool")** → not planned.
- **Optimistic UI on delete** → not planned in v1. Wait for confirmation then invalidate; the toast is enough latency-feedback for the 100–250 ms round trip. A future spec can add `useOptimistic` if drivers report perceived sluggishness.

## Prerequisites (already true)

- Spec 04 merged on `develop`. `Trip.user_id` is `CharField(max_length=64)` (Clerk `sub`); `Trip.Meta.indexes = (models.Index(fields=["user_id", "-created_at"]),)` exists. `Trip.route_summary` JSONField is populated by `services.plan_trip`. ORS cache + throttling infra ship.
- Spec 06 merged on `develop`. `TripStop` / `LogEvent` / `LogDay` exist with `on_delete=CASCADE` on the `Trip` FK. `LogDay` has `unique_together = (trip, date)`.
- Spec 07 merged on `develop`. `/trips/<uuid>` detail route exists; `useTripPlan(tripId)` lives at `apps/web-app/src/features/trip-planner/api/trip-plan.ts` with TanStack key `["trip", tripId, "plan"]`. `useTripById(tripId)` exists.
- Spec 08 merged on `develop`. Tabs primitive in `packages/ui`. `formatDistance` / `formatStartAt` utils live in `apps/web-app/src/features/trip-planner/utils/`.
- `_request_user_id` helper, `PerUserScopedThrottle`, `LimitOffsetPagination` already wired (`web_api/settings/base.py#REST_FRAMEWORK`).
- `apiFetch<T>` (`apps/web-app/src/lib/api-client.ts`) + `ApiError` + the MSW harness exist.
- `sonner` `<Toaster />` is mounted in `apps/web-app/src/app/provider.tsx` (verified during spec-09 exploration).
- shadcn `Empty`, `Button`, `Card`, `Skeleton`, `Sidebar`, `SidebarMenu`, `SidebarMenuButton`, `Tabs` are already in `packages/ui`.
- Clerk Core 3 `useUser`, `useAuth` in place; `<RequireAuth>` route wrapper exists from spec 03.
- `@tanstack/react-query` v5 already installed in `apps/web-app`; the `useQuery` / `useMutation` patterns from spec 07 (`useTripPlan`, `usePlanTrip`) are the references to mirror.
- The Bulletproof React `import-x/no-restricted-paths` carve-out pattern is in `apps/web-app/eslint.config.js`; one-line addition for `features/saved-trips` is the same shape as spec 08's `features/log-sheet` entry.
- Validated versions on 2026-05-21: `@tanstack/react-table` 8.21.3 (latest stable, https://www.npmjs.com/package/@tanstack/react-table).

## Boundary

- Touches `apps/web-api/web_api/apps/trips/{views.py, serializers.py, urls.py}` for Unit 9.1.
- Touches `apps/web-api/web_api/apps/trips/managers.py` (NEW, optional per decision 9).
- Touches `apps/web-api/web_api/settings/base.py` for new throttle scopes.
- Touches `apps/web-api/tests/apps/trips/{test_views_list.py, test_views_destroy.py}` (NEW) + `test_throttles.py` (extend if exists).
- Touches `apps/web-api/tests/factories.py` (extend `LogDayFactory` if missing).
- Touches `packages/ui/src/components/ui/{table.tsx, alert-dialog.tsx}` (installed via shadcn CLI; do not hand-edit per `context/code-standards.md`).
- May touch `packages/ui/package.json` (the shadcn install may add `@radix-ui/react-alert-dialog` peer/runtime dep).
- Touches `apps/web-app/src/features/saved-trips/**` (NEW feature folder + colocated tests; ~12 files including tests).
- Touches `apps/web-app/src/app/routes/{trips-history.tsx, trips-history.test.tsx}` (NEW).
- Touches `apps/web-app/src/app/router.tsx` (add route).
- Touches `apps/web-app/src/components/app-shell/app-sidebar.tsx` + `app-sidebar.test.tsx` (sidebar nav).
- Touches `apps/web-app/src/testing/handlers.ts` (add MSW handlers).
- Touches `apps/web-app/package.json` (add `@tanstack/react-table`).
- Touches `apps/web-app/eslint.config.js` (one-line carve-out).
- Touches `context/progress-tracker.md` (post-implementation, last commit).
- Does **NOT** touch `apps/web-api/web_api/hos/**` — spec-05 boundary test passes verbatim.
- Does **NOT** touch `apps/web-auth/**`, `packages/eslint-config/**`, `packages/typescript-config/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.
- Does **NOT** touch `apps/web-app/src/features/log-sheet/**` (spec 08 surface stays as merged).
- Does **NOT** touch `apps/web-app/src/features/trip-planner/**` — saved-trips imports its utils + schemas one-way; trip-planner stays unchanged.
- Does **NOT** add a migration. Zero schema change.

**Boundary spans BE + FE; the split is internal (Unit 9.1 + 9.2) per decision 20.**

## Sequencing

Order: BE first (Unit 9.1) so the FE has a real endpoint shape to test against; shadcn primitives next; FE feature folder third; route + sidebar fourth; verification + sub-agent reviews fifth; progress tracker + PR sixth.

### Step 1 — Unit 9.1: BE views + serializer + URLs + tests

1. Verify the current shape of `web_api/apps/trips/views.py` and `urls.py` — confirm whether `TripRetrieveView` exists and whether to promote it to `RetrieveDestroyAPIView` (decision 5) or add a sibling `TripDestroyView`. Implementer's call; document the choice in the PR body.
2. Add `TripListItemSerializer` to `serializers.py` per decision 1. Include `days_count` as a `SerializerMethodField` reading from the annotated queryset OR (cleaner) declare `days_count = serializers.IntegerField(read_only=True)` and rely on the queryset annotation. Pick the second — it's the canonical DRF pattern for annotated fields and doesn't add an N+1 risk.
3. Add `TripListView(ListAPIView)` + (if not promoting) `TripDestroyView(DestroyAPIView)` to `views.py`. `get_queryset` uses `Trip.objects.filter(user_id=_request_user_id(self.request)).order_by("-created_at")` (with `.annotate(days_count=Count("log_days", distinct=True))` for the list view). Throttle scopes via the existing `PerUserScopedThrottle` pattern; copy the structure from `TripPlanView`.
4. Add the two new URL paths to `urls.py`. Verify Django picks the right view for `GET /api/trips/` (list) vs the existing retrieve (`GET /api/trips/<uuid:id>/`) — Django path converters disambiguate.
5. Add `trip_list = 60/min` and `trip_delete = 20/min` to `web_api/settings/base.py#DEFAULT_THROTTLE_RATES`.
6. Add `apps/web-api/tests/apps/trips/test_views_list.py` per decision 9. Use `@pytest.mark.django_db` + `TripFactory` (+ `LogDayFactory` for the `days_count` assertion). Throttle test uses `time_machine.travel(...)` or the DRF throttle test pattern from `test_throttles.py`.
7. Add `apps/web-api/tests/apps/trips/test_views_destroy.py` per decision 9.
8. Extend `apps/web-api/tests/apps/trips/test_throttles.py` (or create it if missing) with scope-name coverage for `trip_list` + `trip_delete`.
9. Run the test suite locally:
   ```bash
   cd apps/web-api
   uv run ruff check
   uv run ruff format --check
   uv run mypy
   uv run pytest -q
   ```
   All green before moving on.
10. Commit Unit 9.1 with a single `feat(web-api): trip list + destroy endpoints (spec 09 unit 9.1)` Conventional Commit. (If splitting into a separate PR per decision 20, this is the first commit on `feat/09-saved-trips-be`.)

### Step 2 — shadcn `table` + `alert-dialog` primitives

1. Verify upstream peer versions at install time:
   ```bash
   pnpm view @radix-ui/react-alert-dialog version
   ```
   Record in PR body per `CLAUDE.md` validation discipline.
2. Install both primitives via `npx -y shadcn@latest add table alert-dialog --yes` run from `packages/ui` (per spec 08 amendment 2 — `npx`, not `pnpm dlx`). Confirm `packages/ui/src/components/ui/{table.tsx, alert-dialog.tsx}` land; do NOT hand-edit.
3. Confirm `packages/ui/package.json#exports` resolves both via the existing pattern key.
4. `pnpm exec turbo run typecheck --filter ui` — must pass.

### Step 3 — Unit 9.2: FE schemas + API hooks

1. Add `@tanstack/react-table@^8.21.3` to `apps/web-app/package.json`; run `pnpm install`. Verify lockfile updates land in the same commit as the manifest change.
2. Create `apps/web-app/src/features/saved-trips/schemas/saved-trip.ts` + `trips-list-response.ts` per decision 12. Mirror spec 07's `trip-plan.ts` shape: `z.coerce.number()` for decimal strings, `z.iso.datetime({ offset: true })` for timestamps.
3. Add colocated tests for both schemas (3–5 assertions each: happy-path parse, malformed shape rejection, optional-field handling).
4. Create `api/list-trips.ts` (TanStack `useQuery`) per decision 12. Query key `["trips", "list", { limit, offset }]`. Mirror the call signature of `useTripPlan`.
5. Create `api/delete-trip.ts` (TanStack `useMutation`) per decision 12. `onSuccess` invalidates `["trips", "list"]`. Cite https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation.
6. Add colocated tests for both hooks (mock `apiFetch`, assert query/mutation behavior).
7. Add `features/saved-trips` to the ESLint feature-allowlist in `apps/web-app/eslint.config.js`.
8. `pnpm --filter web-app test --run features/saved-trips` — green.

### Step 4 — Unit 9.2 cont'd: Components (table, dialog, empty, pagination)

1. Create `components/saved-trips-empty.tsx` per decision 17.
2. Create `components/saved-trips-pagination.tsx` per decision 15. Reads `pageIndex` + `pageCount` from props (route owns the state); calls `onPrevious` / `onNext` callbacks.
3. Create `components/delete-trip-dialog.tsx` per decision 16. Wires the trash button trigger to `AlertDialog`; Confirm fires `useDeleteTrip().mutate({id})`.
4. Create `components/saved-trips-table.tsx` per decisions 14 + 15:
   - `useReactTable({ data: results, columns, manualPagination: true, pageCount, state: { pagination }, onPaginationChange: setPagination, getCoreRowModel: getCoreRowModel() })` — server-side pagination per the shadcn DataTable example's "Manual Pagination" section.
   - Five-column `ColumnDef<SavedTrip>[]` inline.
   - Row click handler navigates; trash button stops propagation.
   - Loading state renders 10 Skeleton rows; error state renders `Empty` with retry; empty state renders `SavedTripsEmpty`.
5. Add colocated tests for each component. The table test should cover: 3-row render against the MSW fixture, row click navigation (assert `useNavigate` called with the right path), pagination disabled state at boundaries, loading skeletons, empty state.
6. `pnpm --filter web-app test --run features/saved-trips` — green.

### Step 5 — Route + sidebar wire-up

1. Create `apps/web-app/src/app/routes/trips-history.tsx`:
   ```tsx
   export function TripsHistoryRoute() {
     const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
     const query = useTripList({ limit: pagination.pageSize, offset: pagination.pageIndex * pagination.pageSize });
     return (
       <div className="…">
         <h1 className="font-display text-2xl">Saved trips</h1>
         <SavedTripsTable
           data={query.data}
           isLoading={query.isLoading}
           isError={query.isError}
           pagination={pagination}
           onPaginationChange={setPagination}
           onRetry={query.refetch}
         />
       </div>
     );
   }
   ```
   Wrap in `<RequireAuth>` + `<Suspense fallback={<SpotterLoader size="lg" />}>` at the route layer (mirrors spec 03's pattern).
2. Add the route to `apps/web-app/src/app/router.tsx`. Insert `{ path: "trips", element: <TripsHistoryRoute /> }` BEFORE the existing `trips/:id` and `trips/new` routes inside the authenticated layout. React Router's static `trips` will match before the dynamic `trips/:id`.
3. Update `apps/web-app/src/components/app-shell/app-sidebar.tsx` per decision 19. Add the `<SidebarMenuItem>` with `<SidebarMenuButton>` icon + label.
4. Extend MSW handlers in `apps/web-app/src/testing/handlers.ts` per the In list. Export `mockSavedTripsList`, `mockSavedTripsListEmpty`, and `mockDeleteTrip` named so other tests can import them.
5. Add `trips-history.test.tsx` exercising the full route (RequireAuth gate, loading, success, empty).
6. Update `app-sidebar.test.tsx` (or create it) — assert nav item renders, has the correct icon, the `data-active` state matches `/trips`.
7. `pnpm --filter web-app test --run` — full FE suite passes.

### Step 6 — Local verification + sub-agent reviews

1. `pnpm exec turbo run lint typecheck test --affected` — green.
2. `pnpm format:check` — green.
3. BE pipeline: `cd apps/web-api && uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest -q` — green.
4. Bundle delta: `pnpm --filter web-app build`. Compare entry chunk vs spec 08 baseline (793.19 KB raw / 241.19 KB gzip). `@tanstack/react-table` adds ~14 KB gzip; the saved-trips feature folder adds ~5 KB gzip; expect ~+20 KB gzip total. Acceptable: ≤ +25 KB gzip. Record exact numbers in PR body.
5. Browser smoke (user's workstation, deferred per spec 06/07/08 precedent):
   - Sign in. Plan trips A, B, C (different addresses, varying cycle hours). Navigate to `/trips`.
   - Table shows 3 rows, newest-first. Each row shows route, distance, days, departs, created (relative).
   - Click row B → navigates to `/trips/<B-uuid>` and the map + log sheets render from the persisted plan (no replan, no ORS call — verify via Network tab).
   - Back to `/trips`. Click trash on A. Dialog opens. Cancel closes. Trash again → Delete. Toast appears. Row A disappears.
   - Sidebar collapses (`Cmd/Ctrl+B`). "Saved trips" icon stays visible with tooltip on hover.
   - Plan 60+ trips (or seed via Django admin). Verify pagination: page 1 = 50, page 2 = remainder. Prev/Next disable correctly.
   - Sign out and navigate to `/trips` directly. Redirects to auth.
6. Sub-agent reviews (per `CLAUDE.md` matrix):
   - `code-reviewer` — required.
   - `architect-review` — required because new public API endpoints land (invariant #5 surface). Specifically verify: foreign trip → 404 (no oracle), thin-list-serializer payload, throttle scopes plumbed via `PerUserScopedThrottle`, days_count annotation N+1-safe.
   - `security-auditor` — required: DELETE on `<uuid>` ownership-filtered, no leaked existence, throttle scope per-user, no SQL injection in the annotated queryset.
   - `django-pro` — required: ORM hygiene (annotation, `prefetch_related` if needed, `select_related` for any FK reads), `LimitOffsetPagination` envelope, transaction discipline.
   - `typescript-pro` — required: zod schema parity with the BE serializer, TanStack v5 idioms, `@tanstack/react-table` column definitions type-safe.
   - `ui-visual-validator` — required: table semantics (`<TableCaption sr-only>`), AlertDialog Title + Description, keyboard reachability of rows + trash button + dialog actions, target sizes ≥ 24×24 px, focus ring on rows.
   - `performance-engineer` — required: bundle delta + table render cost on 50-row page + react-query cache discipline.
7. Address all CRITICAL + MAJOR findings before opening the PR.

### Step 7 — Progress tracker + PR

1. Append the "Completed" entry to `context/progress-tracker.md` mirroring spec 08's entry format (date, branch, summary, test count delta, sub-agent reviews + resolutions, key trade-offs). Move spec 09 from "Next Up" to "Completed". Spec 10 stays in "Next Up" position 1.
2. Open the PR against `develop` per `CONTRIBUTING.md` flow. PR title: `feat(web-api,web-app): saved trips list + delete (spec 09)`. Fill every section of `.github/pull_request_template.md` per `CLAUDE.md` output rules. Cite the `@tanstack/react-table` 8.21.3 + `@radix-ui/react-alert-dialog` (version recorded at install) + DRF `ListAPIView` / `DestroyAPIView` + shadcn DataTable + AlertDialog upstream docs per validation discipline.
3. Invoke `code-reviewer` + the conditional agents per step 6. Resolve any CRITICAL / MAJOR findings in follow-up commits on the same branch before merge.
