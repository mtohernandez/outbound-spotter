# 10 — Client-side PDF export + server-side export-history audit

> Closes success criterion #6 from `context/project-overview.md` — "Logs can be exported to a single PDF entirely client-side (no Chromium in production)." Adds a one-click "Export PDF" button to the spec-07/08 `/trips/<uuid>` route that takes the spec-08 §395.8 SVG output and concatenates it into a downloadable PDF via `svg2pdf.js@2` + `jsPDF@4`. Two render paths: default is **multi-page** (one §395.8 sheet per US Letter page, FMCSA-printing style), and an opt-in **single-page** mode stacks every day's sheet onto one tall composite page. Mode toggle lives in an export dialog. The PDF generation itself remains client-only per architecture invariant #6 — the SVG produced by spec 08 is intentionally PDF-friendly (viewBox-based, no `<foreignObject>`, primitives-only). Sibling spec to Spec 09 (Saved Trips); both close the assessment-readiness criteria.
>
> **Revised 2026-05-21** to also bundle a server-side `TripExport` audit-row table and a `/exports` history surface (driver request: "watch the exports made and being able to recreate them without saving the files or caching the files to save storage"). Each export click writes one metadata-only row — mode, sheet count, denormalized trip route labels, timestamp — **the PDF blob is never persisted server-side; invariant #6 is strengthened, not violated.** Implementation rolls out across three sequential branches off `develop`: **10a** (Phase 0 docs + Phase 1 BE), **10b** (Phase 2 FE PDF), **10c** (Phase 3 FE history). The spec is the single source of truth across all three branches.

## Goal

After this spec ships, the driver viewing `/trips/<uuid>` (on either the Map tab or the Log Sheets tab) clicks "Export PDF" in the route header, picks Multi-page or Single-page in a dialog, and a PDF downloads into the browser. The PDF preserves the §395.8 layout pixel-for-pixel — same grid geometry, same duty-status line topology, same Remarks city/state labels, same totals, same signature italic, same metadata header — relative to the on-screen SVG the driver was reviewing. The download is client-side; only a small metadata row is recorded server-side so the driver can browse a paginated `/exports` history and re-download any prior export.

Five user-visible additions:

1. **"Export PDF" button** in the route header on `/trips/<uuid>` — a shadcn `Button` (`variant="outline" size="sm"` to match the existing Tabs density) with a `lucide-react` `FileDown` icon in the `data-icon` slot. Mounted in the TabsList area (currently bare per spec 08); visible on both Map and Log Sheets tabs.
2. **Export dialog** — shadcn `Dialog` (already installed; not `AlertDialog`, since this is not destructive). Title "Export PDF". Body holds a `ToggleGroup type="single"` with two options ("Multi-page" / "Single-page") per `context/ui-context.md` rule "Option sets (2–7 choices) use ToggleGroup, not a button row." Default `multi-page`. Footer holds Cancel + Export buttons. The Export button shows `aria-busy="true"` + a `Loader2` icon + disabled state while rendering.
3. **Multi-page render path** — one US Letter portrait page per `LogDay`. Each page renders the spec-08 SVG verbatim (header chrome + grid + remarks + totals + footer + signature). Page-break is one log per page; matches how an FMCSA inspector or a carrier expects a paper log book to print.
4. **Single-page render path** — all `LogDay` sheets stacked vertically on one custom-height Letter-width page. Useful for at-a-glance review or sharing a multi-day trip in a single document. The viewport height is `N × sheetHeight + (N - 1) × gutter + topMargin + bottomMargin`.
5. **Exports history at `/exports`** — a third sidebar item (`Exports`, lucide `History` icon) placed after `Saved trips`. Opens a paginated data-table mirroring the spec-09 saved-trips look-and-feel. Each row shows the trip's denormalized route labels (current → pickup → dropoff), mode badge, sheet count, exported-at timestamp, and per-row actions: **Recreate** (re-runs the orchestrator against the same trip with the recorded mode; appends `-recreated-${HHMMSS}` to the filename; **does NOT create a new audit row**) and **Delete** (removes the audit row only — the PDF on the user's disk is untouched).

After download the dialog closes and a `sonner` toast announces "Exported <filename>". On failure the toast shows the error and the dialog stays open so the driver can retry. The post-download `POST /api/exports/` write is fire-and-forget — the PDF already downloaded; an audit-row failure logs a `console.warn` but never blocks the user.

Architecture invariants from `context/architecture.md` hold:

- **#1 (HOS planner pure)** — zero touch on `web_api/hos/**`; the spec-05 boundary test passes verbatim.
- **#4 (no client-side HOS math)** — the renderer reads persisted `LogEvent` + `LogDay` rows from the spec-06 plan envelope; nothing about the PDF pass touches duty-status math.
- **#5 (ownership)** — applies now: every `/api/exports/` endpoint filters by `request.user_id` from the Clerk JWT. POST re-checks ownership of the supplied `trip_id` against `Trip` (404 if foreign — no oracle). GET/DELETE filter the queryset so foreign rows surface as 404.
- **#6 (PDF export client-only) — strengthened by this spec.** No `puppeteer`, `headless-chrome`, `playwright`, `weasyprint`, or any other server-side PDF tool is added. PDF generation runs in the same browser session that rendered the SVG; the user's machine is the only PDF source. **`TripExport` is a metadata-only audit row — mode, sheet_count, denormalized trip labels, timestamp — never the PDF bytes.** `TripExport.delete` removes only the audit row; the user-side PDF file is untouched.
- **#7 (theme tokens only)** — the PDF inherits the SVG's `stroke="currentColor"` and CSS-variable font families. The export pass substitutes resolved fonts via `getComputedStyle` (decision 5) so svg2pdf doesn't ship the raw `var(...)` string.
- **#8 (no custom sub-agents)** — reviews use the wshobson marketplace agents.
- **#9 (specs drive implementation)** — this file is the source of truth.

## Decisions of record (resolved at planning time)

Pre-resolved during the spec-10 planning session. Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-flickering-prism.md`. Resolved decisions ordered: library choice → render strategy → mode shape → integration → testing.

1. **Libraries: `svg2pdf.js@2` + `jspdf@4`.** Versions verified on 2026-05-21 via `npm view svg2pdf.js version` (returned `2.7.0`) and `npm view jspdf version` (returned `4.2.1`). Both match the architecture-spec pins from `context/architecture.md#Stack versions` (`svg2pdf.js 2 + jsPDF 4`); no architecture-spec drift to reconcile. Cite:
   - `svg2pdf.js` README: https://github.com/yWorks/svg2pdf.js
   - `jsPDF` docs: https://artskydj.github.io/jsPDF/docs/jsPDF.html
     Both ship MIT-licensed. Combined gzipped bundle weight: ~110 KB. Per spec 07's lazy-chunk precedent (the leaflet `React.lazy` split), the entire `features/pdf-export/lib/render-trip-pdf.ts` orchestrator is dynamically imported inside the dialog's Export-click handler — `await import("./lib/render-trip-pdf")`. The libraries land in a `pdf-export-*.js` chunk via Vite/Rolldown's natural split (no `manualChunks` carve-out per spec 07's CRITICAL finding); the entry chunk is unaffected.

2. **`pdf.svg(node, { x, y, width, height })` is the rendering primitive.** jsPDF v4 ships with the svg2pdf plugin pre-registered via `jspdf/dist/jspdf.es.min.js` import; `pdf.svg` is the canonical entry. We pass the live in-DOM `<svg>` element OR (preferred) a cloned + detached SVG element with resolved CSS so the renderer reads from a fully-styled subtree. Per the svg2pdf README "Element styling" section, the plugin reads `getComputedStyle` on the passed node — meaning we must clone the node into a document that has the same stylesheets in scope, OR walk the clone and write resolved `font-family` / `font-size` / `fill` / `stroke` as element attributes before serialization.

3. **SVG cloning + style hydration** — orchestrator helper `cloneSvgForExport(svgEl: SVGSVGElement): SVGSVGElement`:
   - `const clone = svgEl.cloneNode(true) as SVGSVGElement;`
   - Walk every descendant `Element`. For each, read `getComputedStyle(originalEl)` and write the relevant computed values onto the clone via `clone.setAttribute("font-family", ...)` / `setAttribute("font-size", ...)` / `setAttribute("fill", ...)` / `setAttribute("stroke", ...)` / `setAttribute("stroke-width", ...)`. This replaces the CSS-variable indirection with concrete strings.
   - The clone is appended to a hidden off-screen `<div style="position:fixed; left:-9999px; top:-9999px; visibility:hidden">` so it's part of the DOM (svg2pdf needs that) but invisible. The container is removed after rendering completes.
   - Why a clone, not the live SVG: editing the live SVG's attributes would force a repaint cascade the user can see. Why not `serializeToString` + reparse: `getComputedStyle` only works on connected nodes; the clone-and-attach approach keeps the read working.
     Documented as a non-obvious WHY comment in `cloneSvgForExport`.

4. **Font handling — CSS variables resolve via `getComputedStyle`.** The spec-08 SVG uses `font-family: var(--font-sans)` / `var(--font-display)` / `var(--font-mono)`. Cloning into a styled DOM (decision 3) means `getComputedStyle(textEl).fontFamily` returns the resolved fallback chain (e.g., `"Geologica", "DM Sans", system-ui, ...`). We write that resolved string back onto the clone's `<text>` elements. svg2pdf then maps the family chain to the closest jsPDF-embedded font. **In v1 we do NOT bundle custom font files into jsPDF**; the PDF renders with jsPDF's built-in Helvetica / Times / Courier substitutions for the configured fallbacks. Geologica + DM Sans will substitute to Helvetica (sans-serif) and `font-mono` will substitute to Courier. This is acceptable for v1 — the PDF remains legible and §395.8-compliant; a future spec can ship the Geologica/DM Sans `.ttf` files via `pdf.addFileToVFS` + `pdf.addFont` if drivers report typography mismatches. **Document this trade-off in the export dialog**: a single-line caption below the toggle reads "PDF uses standard PDF fonts (Helvetica) for compatibility." Cite svg2pdf README "Fonts" section.

5. **Multi-page render path** (`renderMultiPage(plan, trip, metadata): Promise<Blob>`):
   - `const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true })`.
   - US Letter portrait = 612 × 792 pt. Spec-08 sheet viewBox = 896 × 820 (px-equivalent). Scale to fit width with margin: page width 612 − 36 × 2 = 540 pt usable; scale factor = 540 / 896 ≈ 0.603. Rendered sheet height = 820 × 0.603 ≈ 494 pt; vertically centered with `y = (792 − 494) / 2 ≈ 149 pt`.
   - For each `LogDay` (already date-ascending from the spec-08 strip):
     1. Find the corresponding live `<svg>` in the DOM (each `DailyLogSheet` exposes a stable `id` of shape `daily-log-sheet-${day.id}` per spec 08's `sheetId` prop).
     2. Clone + hydrate per decision 3.
     3. `await pdf.svg(clone, { x: 36, y: 149, width: 540, height: 494 })`.
     4. If not the last day, `pdf.addPage()`.
     5. Remove the hidden clone container.
   - Return `pdf.output("blob")`.
   - The spec-08 sheet `id` attribute requires a sheet-level change documented in decision 11.

6. **Single-page render path** (`renderSinglePage(plan, trip, metadata): Promise<Blob>`):
   - Compute total page height = `topMargin + N × sheetHeight + (N − 1) × gutter + bottomMargin`. With `topMargin = bottomMargin = 36 pt`, `gutter = 18 pt`, `sheetHeight = 494 pt`: 5 days → `36 + 5*494 + 4*18 + 36 = 36 + 2470 + 72 + 36 = 2614 pt`.
   - `const pdf = new jsPDF({ unit: "pt", format: [612, totalHeight], orientation: "portrait", compress: true })` — custom format. (Tall PDFs are valid; most modern viewers handle multi-screen-height pages with vertical scroll.)
   - For each `LogDay` at vertical offset `36 + i × (sheetHeight + gutter)`: clone + hydrate + `await pdf.svg(clone, { x: 36, y: offset, width: 540, height: 494 })`.
   - No `addPage` calls.
   - Return `pdf.output("blob")`.

7. **Filename convention.** `trip-${tripIdShort}-logs-${YYYYMMDD}.pdf` where `tripIdShort = tripId.slice(0, 8)` (first 8 chars of the UUID; readable, collision-unlikely in a user's downloads folder) and `YYYYMMDD` is today's date in the browser's local TZ via `Intl.DateTimeFormat` with `year/month/day` `2-digit` parts joined without separators. Example: `trip-8c2d4f1a-logs-20260521.pdf`. Append `-singlepage` for the single-page variant: `trip-8c2d4f1a-logs-20260521-singlepage.pdf`. The download uses a programmatic `<a download={filename}>` click; `pdf.save(filename)` is an equivalent jsPDF helper.

8. **Mount the button in the TabsList area of `trips-detail.tsx`.** Spec 08 lands the `<Tabs>` wrap; the TabsList currently holds two `<TabsTrigger>`s. Add a `<div className="ms-auto">` sibling to TabsList (inside the same flex container) holding the Export button — `ms-auto` pushes it to the trailing edge of the row. The button is visible regardless of the active tab. Disabled while `query.isLoading` (no plan to export) or `query.error` (no data) and while `useExportPdf().isPending` (export in flight).

9. **Toggle UI via `ToggleGroup type="single"`.** Two `<ToggleGroupItem value="multi-page">` / `<ToggleGroupItem value="single-page">` children with descriptive labels ("Multi-page (one log per page)" / "Single-page (all logs stacked)") and icons (`Files` for multi, `FileText` for single, both lucide). Default `multi-page`. The toggle group is the `value` prop on a controlled state in the dialog component. `ToggleGroup` must already be in `packages/ui` from a prior spec — verify via `ls packages/ui/src/components/ui/ | grep toggle-group`; if missing, install via `npx -y shadcn@latest add toggle-group --yes` from `packages/ui` and add to the boundary.

10. **`useExportPdf` hook** wraps the orchestrator and exposes `{ exportPdf(mode: "multi-page" | "single-page"): Promise<void>, isPending: boolean, error: Error | null }`. Internally uses React 19's `useActionState` per `context/code-standards.md` ("React 19 idioms: prefer useActionState ... where they replace bespoke loading-state hooks"). `exportPdf` lazy-imports the orchestrator (`await import("../lib/render-trip-pdf")`), calls the right render path, triggers the download, and `toast.success` on success. On error, `toast.error` shows the message and the hook surfaces the error to the dialog.

11. **`DailyLogSheet` gains a stable `id` attribute on the root `<svg>`.** Today's spec 08 implementation (per `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx`) passes `sheetId` as a prop and uses it for the `<title>` / `<desc>` ids. The export needs to look up each live `<svg>` to clone — the cleanest contract is `<svg id={`daily-log-sheet-${day.id}`}>`. **This is the one cross-feature edit in this spec**: `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx` gains `id={`daily-log-sheet-${day.id}`}` on the root SVG. The `id` is also useful for deep-linking from an a11y skip-link in a future spec. Update the spec-08 colocated test (`daily-log-sheet.test.tsx`) to assert the id; one-line addition. No spec-08 behavioral change.

12. **Tests** (`apps/web-app/src/features/pdf-export/**`):
    - `lib/render-trip-pdf.test.ts` — mocks svg2pdf via `vi.mock("svg2pdf.js", () => ({ svg2pdf: vi.fn().mockResolvedValue(undefined) }))` and jsPDF via `vi.mock("jspdf", () => ({ default: class { svg = vi.fn().mockResolvedValue(undefined); addPage = vi.fn(); output = vi.fn().mockReturnValue(new Blob(["%PDF-stub"])); save = vi.fn(); } }))`. Asserts: (a) multi-page mode calls `pdf.svg` N times and `pdf.addPage` N-1 times for an N-day plan; (b) single-page mode calls `pdf.svg` N times and `pdf.addPage` 0 times; (c) returned value is a Blob; (d) clone hydration walks every text element and writes `font-family`.
    - `lib/clone-svg-for-export.test.ts` — feed a fixture SVG with `style="font-family: var(--font-sans)"`; assert the clone has the resolved fallback string as an attribute.
    - `components/export-dialog.test.tsx` — dialog opens on trigger; toggle changes mode; Cancel closes without firing; Export calls the hook with the selected mode; `aria-busy` toggles during pending.
    - `components/export-button.test.tsx` — disabled while loading/error/pending; click opens the dialog.
    - `hooks/use-export-pdf.test.ts` — pending state plumbing; success toast fires; error path keeps dialog open.
      These tests run fully offline; no real PDF is generated.

13. **No print-stylesheet path (`@media print`).** PDF export supersedes browser print for v1. A future spec can add a print stylesheet if drivers want CMD-P; v1 does not.

14. **No PDF/A archival profile, no watermarking, no encryption, no signature embedding.** The PDF is a faithful rendering of the SVG the driver reviewed; it carries no extra metadata. The signature is the typed-italic `<text>` from spec 08 decision 13, which lands in the PDF as a vector glyph automatically. A future spec can add `pdf.setProperties({ title, author, creator })` if compliance review requires it; v1 leaves the metadata default.

15. **No multi-trip merge (e.g., "Export the last 3 trips into one PDF").** Out of scope. Each export is one trip's logs.

16. **Browser smoke deferred to user's workstation** (mirrors specs 06 / 07 / 08 precedent). The agent lacks Clerk + ORS secrets to plan a real trip; the unit tests with mocked svg2pdf cover the orchestrator logic. The user verifies PDF fidelity by exporting both modes and opening in Preview / Adobe / Chrome on their workstation per Sequencing Step 6.

17. **Lazy chunk only — `features/pdf-export/lib/render-trip-pdf.ts` is dynamically imported** from inside the `useExportPdf` hook's `exportPdf` callback. Per spec 07's CRITICAL finding: do NOT add a `manualChunks` carve-out for the PDF libraries — Vite/Rolldown's natural lazy split handles the boundary correctly. Verify in `dist/index.html` that no `pdf-export-*.js` preload tag appears.

---

### Spec revision (2026-05-21) — decisions 18–26 for the bundled BE + FE-history scope

18. **New Django app `web_api/apps/exports/`.** Mirrors `web_api/apps/trips/` file-for-file (`apps.py`, `models.py`, `managers.py`, `serializers.py`, `views.py`, `urls.py`, `migrations/0001_initial.py`). Registered in `INSTALLED_APPS` after `web_api.apps.trips`. Mounted at `path("api/exports/", include("web_api.apps.exports.urls"))` in `web_api/urls.py`.

19. **`TripExport` model fields.** PK `id UUIDField(default=uuid.uuid4, editable=False)`. Ownership `user_id CharField(max_length=64)` (Clerk JWT `sub`, mirroring `Trip.user_id`). FK `trip ForeignKey(Trip, on_delete=models.SET_NULL, null=True, related_name="exports")`. **Denormalized trip route labels** `trip_current_label`, `trip_pickup_label`, `trip_dropoff_label` — each `CharField(max_length=255)`, captured server-side at create time from the Trip row, so audit records survive trip deletion. `mode CharField(max_length=16, choices=ExportMode.choices)` where `ExportMode(models.TextChoices)` declares `MULTI_PAGE = "multi_page", "Multi-page"` and `SINGLE_PAGE = "single_page", "Single-page"` (snake_case at the DB layer matching `StopKind` / `DutyStatusChoices` precedent; the serializer translates to/from the kebab-case FE wire contract). `sheet_count PositiveSmallIntegerField()` — server-computed from `trip.log_days.count()`, never FE-supplied (tamper resistance). `created_at DateTimeField(auto_now_add=True)`. `Meta.indexes = (Index(fields=["user_id", "-created_at"]), Index(fields=["trip"]))`, `Meta.ordering = ("-created_at",)`. Manager `TripExportManager(Manager["TripExport"])` exposes `.for_user(user_id) -> QuerySet[TripExport]` and `.for_trip(trip_id) -> QuerySet[TripExport]`. A module-level docstring documents the snake_case-vs-kebab-case dual-mode contract so `architect-review` doesn't flag it as drift.

20. **Endpoint shape — mirrors the spec-09 `Trip` precedent.**
    - `TripExportListCreateView(ListAPIView[TripExport])` at `GET /api/exports/` + custom `post()` at `POST /api/exports/`. (Not `ListCreateAPIView` — we keep parity with `TripListCreateView` so the per-method throttle-scope flip works under the same `get_throttles` shape.) GET: ownership-filtered queryset, ordered newest-first, paginated by the project-wide `CappedLimitOffsetPagination`. POST: validate `{ trip_id: UUIDField, mode: ChoiceField(["multi-page", "single-page"]) }` via `TripExportCreateRequestSerializer` → resolve `Trip.objects.filter(id=trip_id, user_id=request.user_id).first()` (404 if not owned — no oracle) → compute `sheet_count = trip.log_days.count()` (422 if zero, with a defensive error message; the spec-06 invariant guarantees this can't happen but the view stays defensive) → create the row inside `transaction.atomic` with the four denormalized fields (mode translated to snake_case, three labels copied from `Trip`) → 201 with `TripExportResponseSerializer`. `get_throttles` flips `throttle_scope` between `export_create` (POST) and `export_list` (GET) the same way `TripListCreateView` does.
    - `TripExportDestroyView(RetrieveDestroyAPIView[TripExport])` at `DELETE /api/exports/<uuid:id>/`. `lookup_field = "id"`. `get_queryset` filters by `user_id` (foreign IDs surface as 404). `throttle_scope = "export_delete"` is unconditionally set in the class body (no method flip; the optional GET is unthrottled and harmless, matching `TripRetrieveDestroyView`'s GET behavior).

21. **Three new throttle keys** appended to `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` in `apps/web-api/web_api/settings/base.py`:
    - `export_create = 60/hour` — exporting is cheap, but 60/hour ≈ 1/min sustained mirrors `trip_create`'s density (30/hour) without admitting noisy log spam.
    - `export_list = 60/min` — mirrors `trip_list` exactly.
    - `export_delete = 20/min` — mirrors `trip_delete` exactly.
      All three are scoped to `request.user_id` via the existing `PerUserScopedThrottle` (no change to the throttle class).

22. **Migration 0001_initial** — generated via `uv run manage.py makemigrations exports`, inspected before commit. No `Trip` schema change is needed; the FK lives entirely on `TripExport`. Reversibility is trivial (`migrate exports zero` drops the table). Tests exercise the migration round-trip in the verification gate.

23. **OpenAPI regeneration** — `apps/web-api/openapi.yaml` is regenerated via `uv run manage.py spectacular --color --file openapi.yaml` in the same commit as the views/serializers land, so the YAML and Python source stay in lockstep (matches `code-standards.md` line 106). The diff is limited to the new `/api/exports/` paths + the `TripExport` component schema.

24. **FE shared-pagination lift, NOT a generic `DataTable<T>` extraction.** The "fourth duplicate" rule from `code-standards.md` line 9 says: extract on the fourth consumer, not the second. `saved-trips-table` + `exports-table` is the second consumer — too early to lift a `DataTable<T>` shell. Instead: move only `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.tsx` → `apps/web-app/src/components/data-table/data-table-pagination.tsx` (rename component to `DataTablePagination`), update the one import in `saved-trips-table.tsx`, and have the new `exports-table.tsx` consume the same shared primitive. The two tables stay as deliberate, near-duplicate copies; promotion to a generic shell waits for a third consumer.

25. **FE feature `apps/web-app/src/features/exports/`**, mirroring the `saved-trips` layout:
    - `schemas/saved-export.ts` — Zod schema for one record: `{ id: uuid, trip_id: uuid().nullable(), mode: enum(["multi-page","single-page"]), sheet_count: number().int().nonnegative(), created_at: iso.datetime(), trip_current_label: string(), trip_pickup_label: string(), trip_dropoff_label: string() }`.
    - `schemas/exports-list-response.ts` — paginated envelope mirroring `tripsListResponseSchema`.
    - `api/query-keys.ts` — `["exports", "list", limit, offset]` (primitives so TanStack equality matches the spec-09 pattern).
    - `api/list-exports.ts` — `useExportsList({limit, offset})`; `staleTime: 60_000`; `retry: (failureCount, error) => …` skipping 401/403/404 to match `useTripList`.
    - `api/create-export.ts` — `useCreateExportRecord()` mutation invalidating the list cache on success.
    - `api/delete-export.ts` — `useDeleteExportRecord()` mutation invalidating the list cache + showing a sonner success toast.
    - `components/exports-table.tsx` — uses `@tanstack/react-table` with the same `manualPagination: true` shape as saved-trips. Columns: TripRouteCell (renders a `<Link>` to `/trips/<trip_id>` when `trip_id !== null`; renders inert text + a `<Badge variant="secondary">Deleted</Badge>` when null), ModeBadgeCell, SheetCountCell, ExportedAtCell, ActionsCell (RecreateExportButton + DeleteExportDialog).
    - `components/recreate-export-button.tsx` — on click: (a) defensive type guard `EXPORT_MODES.includes(record.mode)` (future-proofs against enum drift), (b) fetch the trip plan via the existing `useTripPlan(record.trip_id)` (cache-friendly), (c) if the plan resolves, lazy-import the orchestrator from `features/pdf-export/lib/render-trip-pdf.ts` and call it with `{ recreated: true }` filename suffix, (d) if `trip_id === null` or the plan returns 404, show a sonner toast "Original trip is no longer available — delete this row?" with an inline delete CTA. An `AbortController`-style flag aborts the orchestrator pipeline if the user navigates away mid-render (the browser-`<a download>` click still fires if the blob already exists; acceptable). **Does NOT call `useCreateExportRecord`** — Recreate is logically a re-download of the same export, not a new export.
    - `components/delete-export-dialog.tsx` — shadcn `AlertDialog` with copy clarifying "Removes this record only. Your downloaded PDF is unaffected."
    - `components/exports-empty.tsx` — empty-state composition.
    - Every NEW file colocates a `*.test.{ts,tsx}` sibling.

26. **Sidebar item + route wire-up + ESLint carve-out.**
    - `apps/web-app/src/config/paths.ts` gains `exportsHistory: "/exports"`.
    - `apps/web-app/src/components/app-shell/app-sidebar.tsx` appends a third `<SidebarMenuItem>` AFTER `Saved trips`. Icon: `History` from `lucide-react`. Tooltip: "Exports". Active-state matcher mirrors `isSavedTripsActive` for `/exports`.
    - `apps/web-app/src/components/app-shell/app-sidebar.test.tsx` is updated to assert all three items render with their icons / labels / active states.
    - `apps/web-app/src/app/routes/exports-history.tsx` is a new lazy-loaded route, mirroring the `TripsHistoryRoute` shape (route-level `<Suspense fallback={<SpotterLoader size="lg"/>}>`). Lazy-loading is non-negotiable so `@tanstack/react-table` stays out of the entry chunk on routes other than `/trips` and `/exports`. Colocated `exports-history.test.tsx` covers loading / empty / populated / pagination / recreate / delete / deleted-trip-graceful-degradation paths.
    - `apps/web-app/src/app/router.tsx` registers the new lazy-loaded route at `path: "exports"` under the existing `AppShellLayout` parent.
    - `apps/web-app/eslint.config.js` adds an `exports` carve-out: `except: ["./exports", "./pdf-export", "./trip-planner"]` so the new feature can re-use `ExportMode` + `EXPORT_MODES` + the `renderTripPdf` orchestrator from `pdf-export`, and `useTripPlan` + `formatDistance` / `formatStartAt` from `trip-planner`. The `pdf-export` carve-out (from Phase 2) is updated in the same diff to permit `./exports` so `useExportPdf` can import `useCreateExportRecord`.

## Scope

### In

**Phase 0 — Context revision (branch `feat/10a-trip-exports-backend`, commit first):**

- `context/specs/10-pdf-export.md` (THIS FILE) — extended with decisions 18–26, the revised goal section, the strengthened invariant #6 restatement, and the three-phase sequencing.
- `context/architecture.md` (MODIFY) — three precise edits: add `trip_exports` row to Storage Model; append three throttle keys (`export_create`, `export_list`, `export_delete`) to Rate Limiting; extend Invariant #6 with the metadata-only audit clause.
- `context/progress-tracker.md` — updated at the end of Phase 3 (final commit on `feat/10c-exports-history-frontend`).

**Phase 1 — Backend `apps/web-api/web_api/apps/exports/` (branch `feat/10a-trip-exports-backend`):**

- `apps/web-api/web_api/apps/exports/__init__.py` (NEW).
- `apps/web-api/web_api/apps/exports/apps.py` (NEW) — `ExportsConfig(AppConfig)` mirroring `TripsConfig`.
- `apps/web-api/web_api/apps/exports/models.py` (NEW) — `ExportMode(TextChoices)` + `TripExport(Model)` per decision 19.
- `apps/web-api/web_api/apps/exports/managers.py` (NEW) — `TripExportManager` per decision 19.
- `apps/web-api/web_api/apps/exports/serializers.py` (NEW) — `TripExportCreateRequestSerializer`, `TripExportListItemSerializer`, `TripExportResponseSerializer` per decision 20 (mode kebab↔snake translation).
- `apps/web-api/web_api/apps/exports/views.py` (NEW) — `TripExportListCreateView` + `TripExportDestroyView` per decision 20.
- `apps/web-api/web_api/apps/exports/urls.py` (NEW) — two `path()` entries.
- `apps/web-api/web_api/apps/exports/migrations/__init__.py` (NEW).
- `apps/web-api/web_api/apps/exports/migrations/0001_initial.py` (NEW via `uv run manage.py makemigrations exports`).
- `apps/web-api/web_api/urls.py` (MODIFY) — add `path("api/exports/", include("web_api.apps.exports.urls"))`.
- `apps/web-api/web_api/settings/base.py` (MODIFY) — register `web_api.apps.exports` in `INSTALLED_APPS` after `web_api.apps.trips`; append three throttle keys to `DEFAULT_THROTTLE_RATES`.
- `apps/web-api/tests/conftest.py` (MODIFY) — add `TripExportFactory(DjangoModelFactory)` + `trip_export_factory` fixture mirroring `TripFactory`.
- `apps/web-api/tests/test_exports_views.py` (NEW) — ~14 tests: 401 paths, 404 ownership (foreign trip on POST, foreign export on DELETE), 201 create with denormalized labels, 422 zero-sheet-count defensive check, 200 list filtered by user, label denormalization survives trip deletion, 204 destroy, 404 destroy foreign, three throttle scope tests using the `THROTTLE_RATES` patch pattern, constant query count assertion.
- `apps/web-api/openapi.yaml` (REGENERATE) — `uv run manage.py spectacular --color --file openapi.yaml`; commit the delta in the same commit as the views/serializers.

**Phase 2 — FE `apps/web-app/src/features/pdf-export/**`(branch`feat/10b-pdf-export-frontend`, off `develop` after 10a merges):\*\*

- `apps/web-app/package.json` (MODIFY) — add `svg2pdf.js@^2.7.0` and `jspdf@^4.2.1` to dependencies (re-verify pins on install day).
- `apps/web-app/src/features/pdf-export/types/export-mode.ts` (NEW) — `type ExportMode = "multi-page" | "single-page"` + `EXPORT_MODES` const (single source of truth; FE-only).
- `apps/web-app/src/features/pdf-export/lib/render-trip-pdf.ts` (NEW) — orchestrator. Exports `renderTripPdf(plan, trip, metadata, mode): Promise<Blob>`. Per decisions 5 + 6.
- `apps/web-app/src/features/pdf-export/lib/clone-svg-for-export.ts` (NEW) — `cloneSvgForExport(svgEl): SVGSVGElement` per decision 3.
- `apps/web-app/src/features/pdf-export/lib/filename.ts` (NEW) — `buildPdfFilename(tripId, mode, now?, { recreated?: boolean })` per decision 7. The `recreated` variant appends `-recreated-${HHMMSS}` to disambiguate re-downloads in the user's downloads folder.
- `apps/web-app/src/features/pdf-export/hooks/use-export-pdf.ts` (NEW) — React 19 `useActionState`-based hook per decision 10. After `renderTripPdf` succeeds, calls `useCreateExportRecord().mutate({ trip_id, mode })` **fire-and-forget** (`console.warn` on failure, never toast — the PDF already downloaded). On success the hook invalidates `["exports", "list"]` so the history view stays fresh on next visit.
- `apps/web-app/src/features/pdf-export/components/export-button.tsx` (NEW) — the TabsList button per decision 8.
- `apps/web-app/src/features/pdf-export/components/export-dialog.tsx` (NEW) — the mode-toggle dialog per decisions 2 + 9.
- All NEW files have colocated `.test.{ts,tsx}` siblings per decision 12.
- `apps/web-app/src/app/routes/trips-detail.tsx` (MODIFY) — mount the `<ExportButton />` in the TabsList trailing area per decision 8.
- `apps/web-app/src/app/routes/trips-detail.test.tsx` (UPDATE) — assert the Export button renders; disabled-state coverage.
- `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx` (MODIFY) — add `id={`daily-log-sheet-${day.id}`}` to the root SVG per decision 11.
- `apps/web-app/src/features/log-sheet/components/daily-log-sheet.test.tsx` (UPDATE) — assert the new id.
- `apps/web-app/eslint.config.js` (MODIFY) — add `features/pdf-export` to the feature-allowlist carve-out. One-way imports `pdf-export → log-sheet` (id contract + grid geometry constants), `pdf-export → trip-planner` (zod schemas + `useTripPlan`), and `pdf-export → exports` (the `useCreateExportRecord` mutation hook from Phase 3) are allowed.
- `packages/ui/src/components/ui/toggle-group.tsx` (NEW via `npx -y shadcn@latest add toggle-group --yes` from `packages/ui` — NOT installed today; verify via `ls packages/ui/src/components/ui/ | grep toggle-group` is empty before install).

**Phase 3 — FE `apps/web-app/src/features/exports/**`+ shared pagination (branch`feat/10c-exports-history-frontend`, off `develop` after 10b merges):\*\*

- `apps/web-app/src/components/data-table/data-table-pagination.tsx` (NEW; moved from `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.tsx` and renamed to `DataTablePagination`).
- `apps/web-app/src/components/data-table/data-table-pagination.test.tsx` (NEW; moved colocated test).
- `apps/web-app/src/features/saved-trips/components/saved-trips-table.tsx` (MODIFY) — update one import to use the lifted primitive.
- `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.tsx` (DELETE) — replaced by the lifted primitive.
- `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.test.tsx` (DELETE) — replaced by the colocated test.
- `apps/web-app/src/features/exports/schemas/saved-export.ts` (NEW) — Zod schema per decision 25.
- `apps/web-app/src/features/exports/schemas/exports-list-response.ts` (NEW) — paginated envelope.
- `apps/web-app/src/features/exports/api/query-keys.ts` (NEW).
- `apps/web-app/src/features/exports/api/list-exports.ts` (NEW) — `useExportsList`.
- `apps/web-app/src/features/exports/api/create-export.ts` (NEW) — `useCreateExportRecord`.
- `apps/web-app/src/features/exports/api/delete-export.ts` (NEW) — `useDeleteExportRecord`.
- `apps/web-app/src/features/exports/components/exports-table.tsx` (NEW) — near-copy of `saved-trips-table.tsx` per decisions 24 + 25.
- `apps/web-app/src/features/exports/components/recreate-export-button.tsx` (NEW) — per decision 25.
- `apps/web-app/src/features/exports/components/delete-export-dialog.tsx` (NEW) — per decision 25.
- `apps/web-app/src/features/exports/components/exports-empty.tsx` (NEW).
- Every NEW file colocates a `*.test.{ts,tsx}` sibling.
- `apps/web-app/src/config/paths.ts` (MODIFY) — add `exportsHistory: "/exports"`.
- `apps/web-app/src/app/routes/exports-history.tsx` (NEW) — lazy-loaded route mirroring `trips-history.tsx`.
- `apps/web-app/src/app/routes/exports-history.test.tsx` (NEW) — covers loading, empty, populated, pagination, recreate, delete, deleted-trip-graceful-degradation.
- `apps/web-app/src/app/router.tsx` (MODIFY) — register the new lazy route under `AppShellLayout`.
- `apps/web-app/src/components/app-shell/app-sidebar.tsx` (MODIFY) — append a third `<SidebarMenuItem>` with `History` icon → `/exports`, after `Saved trips`.
- `apps/web-app/src/components/app-shell/app-sidebar.test.tsx` (UPDATE) — assert all three items render with the right icons / labels / active states.
- `apps/web-app/src/testing/handlers.ts` (MODIFY) — add MSW handlers for `GET /api/exports/`, `POST /api/exports/`, `DELETE /api/exports/<id>/`.
- `apps/web-app/eslint.config.js` (MODIFY) — add `exports` carve-out per decision 26; update the `pdf-export` carve-out (added in Phase 2) to permit `./exports` so `useExportPdf` can import `useCreateExportRecord`.

### Out (deferred or not planned)

- **Server-side PDF rendering (Chromium, WeasyPrint, etc.)** → forbidden by invariant #6. Not planned.
- **Print stylesheet (`@media print`)** → not planned in v1 per decision 13.
- **PDF/A archival format** → not planned per decision 14.
- **Watermarking / signature embedding / PDF encryption** → not planned per decision 14.
- **Embedded custom fonts (`pdf.addFileToVFS` + Geologica/DM Sans `.ttf`)** → deferred per decision 4. v1 substitutes to Helvetica/Courier.
- **Multi-trip merge** → not planned per decision 15.
- **PDF metadata (`pdf.setProperties`)** → not planned in v1 per decision 14.
- **Browser print integration (`window.print()`)** → not planned.
- **Email-the-PDF** → not planned in v1.
- **Bulk export from the saved-trips list (Spec 09 surface)** → future spec; the per-trip button is the v1 surface.
- **Persisting the PDF blob server-side** → explicitly forbidden by the strengthened invariant #6. Only metadata (mode, sheet count, denormalized trip labels, timestamp) lives in `trip_exports`.
- **Generic `DataTable<T>` shell extraction** → deferred per decision 24 ("fourth-duplicate" rule). Lift on the third consumer.
- **CASCADE on `trip` FK** → rejected per decision 19; `SET_NULL` + denormalized labels ship instead so audit records survive trip deletion (better UX, defensible via the embedded labels).

## Prerequisites (already true)

- Spec 08 merged on `develop`. `DailyLogSheet` renders one `<svg>` per `LogDay` with viewBox-based scaling, primitives-only glyphs, CSS-variable fonts. The decision-16 PDF-friendliness contract is in place.
- Spec 06 merged on `develop`. `GET /api/trips/<uuid>/plan/` returns the `LogDay[]` + `LogEvent[]` envelope the renderer reads.
- Spec 03 merged. `<Tabs>` route shell on `/trips/:id`; TabsList trailing area is currently empty (one-line addition slot).
- `sonner` `<Toaster />` mounted; `Dialog`, `Button`, `ToggleGroup` (if installed) available in `packages/ui`.
- React 19 `useActionState` available (verified in `react@19.2.6`).
- TanStack Query v5 caching the trip plan via `useTripPlan` so the orchestrator reads from in-memory state, no re-fetch.
- `Intl.DateTimeFormat` covered by browser baseline.
- The Bulletproof React `import-x/no-restricted-paths` carve-out pattern (spec 03 + 08 precedent); one-line addition for `features/pdf-export`.
- Validated versions on 2026-05-21: `svg2pdf.js` 2.7.0 (https://www.npmjs.com/package/svg2pdf.js), `jspdf` 4.2.1 (https://www.npmjs.com/package/jspdf). Both match `context/architecture.md` pins (`svg2pdf.js 2 + jsPDF 4`); no architecture-spec edit needed.

## Boundary

The revised spec crosses backend + frontend. Honor the "one system boundary per unit" workflow rule by **splitting into three sequential branches**, each anchored to this single spec file:

**Branch `feat/10a-trip-exports-backend`** (Phase 0 + Phase 1):

- Touches `context/specs/10-pdf-export.md` (THIS FILE, this revision).
- Touches `context/architecture.md` (storage model, throttling, invariant #6).
- Touches `apps/web-api/web_api/apps/exports/**` (NEW Django app + migration + tests).
- Touches `apps/web-api/web_api/settings/base.py` (INSTALLED_APPS + 3 throttle keys).
- Touches `apps/web-api/web_api/urls.py` (new `include`).
- Touches `apps/web-api/tests/conftest.py` (TripExportFactory).
- Touches `apps/web-api/openapi.yaml` (regenerate).
- Does **NOT** touch `apps/web-app/**`, `apps/web-auth/**`, `packages/**` on this branch.

**Branch `feat/10b-pdf-export-frontend`** (Phase 2):

- Touches `apps/web-app/src/features/pdf-export/**` (NEW feature folder + colocated tests; ~14 files total).
- Touches `apps/web-app/src/app/routes/trips-detail.tsx` + `trips-detail.test.tsx` (Export button mount).
- Touches `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx` (one-line `id` attribute add per decision 11).
- Touches `apps/web-app/src/features/log-sheet/components/daily-log-sheet.test.tsx` (one assertion add).
- Touches `apps/web-app/package.json` (`svg2pdf.js`, `jspdf`).
- Touches `apps/web-app/eslint.config.js` (`pdf-export` carve-out).
- Touches `packages/ui/src/components/ui/toggle-group.tsx` (NEW via shadcn CLI; currently not installed).
- Touches `apps/web-app/src/features/exports/api/create-export.ts` import edge — the `useExportPdf` hook imports `useCreateExportRecord`, which lands ahead of Phase 3. To keep this branch self-contained, **the hook ships with a tiny inline `_writeExportRecord(trip_id, mode)` helper that POSTs directly to `/api/exports/`**; Phase 3 refactors that inline call into the `useCreateExportRecord` mutation when the feature lands. This deviation is documented inline in `use-export-pdf.ts` and removed in Phase 3.
- Does **NOT** touch `apps/web-api/**` on this branch.

**Branch `feat/10c-exports-history-frontend`** (Phase 3):

- Touches `apps/web-app/src/components/data-table/data-table-pagination.{tsx,test.tsx}` (NEW; moved from saved-trips).
- Touches `apps/web-app/src/features/saved-trips/components/saved-trips-table.tsx` (one import update).
- Deletes `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.{tsx,test.tsx}` (replaced by the lifted primitive).
- Touches `apps/web-app/src/features/exports/**` (NEW feature folder + colocated tests).
- Touches `apps/web-app/src/app/routes/exports-history.{tsx,test.tsx}` (NEW).
- Touches `apps/web-app/src/app/router.tsx` (register `/exports`).
- Touches `apps/web-app/src/config/paths.ts` (add `exportsHistory`).
- Touches `apps/web-app/src/components/app-shell/app-sidebar.{tsx,test.tsx}` (third inline item).
- Touches `apps/web-app/src/features/pdf-export/hooks/use-export-pdf.ts` (replace inline POST with `useCreateExportRecord`).
- Touches `apps/web-app/src/testing/handlers.ts` (MSW handlers for `/api/exports/`).
- Touches `apps/web-app/eslint.config.js` (`exports` carve-out + update `pdf-export` carve-out).
- Touches `context/progress-tracker.md` (final commit on the branch — spec 10 marked complete).
- Does **NOT** touch `apps/web-api/**` on this branch.

Across all three branches:

- Does **NOT** touch `apps/web-api/web_api/hos/**` — spec-05 boundary test passes verbatim.
- Does **NOT** touch `apps/web-auth/**`, `packages/eslint-config/**`, `packages/typescript-config/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.

**Boundary is cross-system across three sequential PRs, each single-system.** This is the workflow-compliant decomposition of the user-authorized spec revision.

## Sequencing

The revised spec rolls out across three sequential branches, each one its own PR into `develop`. The legacy Steps 1–7 (FE-only PDF export) live as **Phase 2** below; Phases 0 + 1 (context revision + backend) ship first on `feat/10a`, and Phase 3 (FE history) ships last on `feat/10c`.

### Phase 0 — Context revision (commit first, on `feat/10a-trip-exports-backend`)

Documentation precedes implementation (`context/ai-workflow-rules.md` line 11).

1. Branch off `develop`: `git checkout develop && git pull && git checkout -b feat/10a-trip-exports-backend`.
2. Edit `context/specs/10-pdf-export.md` (THIS FILE) per the revision above. Single commit `docs(context): revise spec 10 to bundle TripExport audit table` covers the spec + architecture edits together.
3. Edit `context/architecture.md`:
   - Storage Model: add `trip_exports` row description after `log_days` block.
   - Rate Limiting: append `export_create=60/hour`, `export_list=60/min`, `export_delete=20/min`.
   - Invariant #6: append the metadata-only audit-row strengthening clause.
4. Stage both files and commit. Run `pnpm format:check` first; no other gate applies to docs-only commits.

### Phase 1 — Backend (continues on `feat/10a-trip-exports-backend`)

1. **App scaffold**:
   - Create `apps/web-api/web_api/apps/exports/__init__.py` (empty).
   - Create `apps/web-api/web_api/apps/exports/apps.py` — `ExportsConfig(AppConfig)`, `default_auto_field = "django.db.models.BigAutoField"`, `name = "web_api.apps.exports"`, `label = "exports"`.
2. **Models + manager**:
   - Create `apps/web-api/web_api/apps/exports/managers.py` — `TripExportManager` with `.for_user(user_id)` and `.for_trip(trip_id)` methods.
   - Create `apps/web-api/web_api/apps/exports/models.py` — `ExportMode(models.TextChoices)` + `TripExport(models.Model)` per decision 19. Set `objects: TripExportManager = TripExportManager()` on the model. Include the module-level docstring documenting the dual-mode contract.
3. **Serializers**:
   - Create `apps/web-api/web_api/apps/exports/serializers.py` — three serializers:
     - `TripExportCreateRequestSerializer(Serializer)` — `trip_id = UUIDField()`, `mode = ChoiceField(choices=[("multi-page","Multi-page"),("single-page","Single-page")])`. The view translates the kebab-case mode to snake_case before persistence.
     - `TripExportListItemSerializer(ModelSerializer)` — read shape with `mode` source-mapped to a `SerializerMethodField` that returns kebab-case, and `trip_id` exposed as the FK column name (auto-renders as `null` when the FK is set to NULL).
     - `TripExportResponseSerializer` — same shape as list item, used for POST 201 response.
4. **Views + URLs**:
   - Create `apps/web-api/web_api/apps/exports/views.py` — `TripExportListCreateView(ListAPIView[TripExport])` + `TripExportDestroyView(RetrieveDestroyAPIView[TripExport])` per decision 20. Mirror the `_request_user_id` helper from `apps/trips/views.py` (or import it; cleaner to keep a local copy so the exports app stays decoupled). The POST flow uses `transaction.atomic` around the create call.
   - Create `apps/web-api/web_api/apps/exports/urls.py` — two `path()` entries (`""`, `"<uuid:id>/"`) matching the trips-app shape.
5. **Wire-up**:
   - Edit `apps/web-api/web_api/settings/base.py` — register `"web_api.apps.exports"` in `INSTALLED_APPS` after `"web_api.apps.trips"`; append three throttle keys to `DEFAULT_THROTTLE_RATES`.
   - Edit `apps/web-api/web_api/urls.py` — add `path("api/exports/", include("web_api.apps.exports.urls"))`.
6. **Migration**:
   - Run `cd apps/web-api && uv run manage.py makemigrations exports` to generate `0001_initial.py`. Inspect the generated file before commit; ensure `Meta.indexes` and `on_delete=SET_NULL` land correctly.
7. **Test infrastructure**:
   - Edit `apps/web-api/tests/conftest.py` — append `TripExportFactory(DjangoModelFactory)` + `trip_export_factory` fixture mirroring `TripFactory` (`trip = SubFactory(TripFactory)`, `mode = ExportMode.MULTI_PAGE`, `sheet_count = 2`, denormalized labels copied from `trip` defaults).
   - Create `apps/web-api/tests/test_exports_views.py` — full test matrix per decision 20: 401 paths, 404 ownership (foreign trip on POST, foreign export on DELETE, invalid UUID), 201 create with denormalized labels persisted, 422 zero-sheet-count, 200 list filtered by user, 200 list paginated at 50, label denormalization survives FK SET_NULL (delete the trip mid-test, re-read the export), 204 destroy, 404 destroy foreign, three throttle scope tests using the `THROTTLE_RATES` patch pattern from `test_trips_destroy_view.py:108`, `django_assert_num_queries` on the list view.
8. **OpenAPI regeneration**:
   - Run `uv run manage.py spectacular --color --file openapi.yaml` from `apps/web-api/`. Commit the delta in the same commit as the views.
9. **Gate**:
   - `cd apps/web-api && uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest` — all green before opening PR 10a.
10. **Sub-agent reviews on 10a** (in order; address CRITICAL/MAJOR before each next agent):
    - `django-pro` — model fields, migration shape, TextChoices conventions, query patterns. Will catch the snake_case-vs-kebab-case mode contract.
    - `python-pro` — type hints in views, narrow exception handling on POST, manager pattern.
    - `security-auditor` — three new endpoints, throttle scopes, ownership re-check on POST (`trip_id` is user-supplied), SET_NULL semantics.
    - `architect-review` — required: new entity, three new throttle scopes, strengthened invariant #6.
    - `code-reviewer` last, on the full diff.
11. **PR 10a**: push branch, open `gh pr create --base develop --head feat/10a-trip-exports-backend --title "feat(web-api): TripExport audit-row table + create/list/destroy endpoints (spec 10 phase 1)"`. Fill the template. Cite this spec + the model patterns mirrored from `apps/trips/`.

### Phase 2 — FE PDF export (branch `feat/10b-pdf-export-frontend`, off `develop` after 10a merges)

The original Steps 1–7 below ship unchanged, with two corrections noted in decision 9 (sidebar item moves to Phase 3) and the boundary deviation (inline `_writeExportRecord` in `useExportPdf`).

### Step 1 — Deps install + version verify

1. Verify versions once more at install time:
   ```bash
   npm view svg2pdf.js version
   npm view jspdf version
   ```
   If different from `2.7.0` / `4.2.1`, update both this spec and (if it drifts from the architecture pin) `context/architecture.md` "Stack versions" in the same commit per the bump policy.
2. Add `svg2pdf.js@^2.7.0` and `jspdf@^4.2.1` to `apps/web-app/package.json` dependencies. Run `pnpm install --filter web-app`. Commit the manifest + lockfile together.
3. Confirm peer-dep warnings are clean (jsPDF v4 self-bundles its dependencies; svg2pdf.js v2 peers on jsPDF).

### Step 2 — Pure lib utilities

1. Create `features/pdf-export/types/export-mode.ts` — discriminated union + const array.
2. Create `lib/filename.ts` + `lib/filename.test.ts` per decision 7. Assertions: short-id slice, date format, mode suffix variant.
3. Create `lib/clone-svg-for-export.ts` + `lib/clone-svg-for-export.test.ts` per decision 3. Use a JSDOM-rendered SVG fixture; assert font-family / fill / stroke get hydrated onto the clone as attributes.
4. Create `lib/render-trip-pdf.ts` per decisions 5 + 6 + 7. Internal helpers: `renderMultiPage(pdf, sheets, layout)`, `renderSinglePage(pdf, sheets, layout)`, `LAYOUT` const (margins, scale, gutter). Public API: `renderTripPdf({ plan, trip, metadata, mode }): Promise<Blob>`.
5. Create `lib/render-trip-pdf.test.ts` per decision 12. Mock svg2pdf + jsPDF; assert call counts per mode + Blob output.
6. `pnpm --filter web-app test --run features/pdf-export/lib` — green.

### Step 3 — Hook

1. Create `hooks/use-export-pdf.ts` per decision 10. Internal: `useActionState` wrapping the dynamic `await import("../lib/render-trip-pdf")` + the download trigger + the sonner toasts. Exports `{ exportPdf, isPending, error }`.
2. **After the PDF download succeeds**, the hook fires a fire-and-forget POST to `/api/exports/` with `{ trip_id, mode }`. On Phase 2 (this branch), the call is inline — a small `_writeExportRecord(tripId, mode): Promise<void>` helper inside `use-export-pdf.ts` that uses the shared `apiClient` and swallows errors via `.catch((err) => console.warn(...))`. **It never blocks the success toast or surfaces the error to the user.** Phase 3 refactors this into the `useCreateExportRecord` mutation that lives under `features/exports/api/`. The inline POST keeps Phase 2 self-contained (no dependency on Phase 3 files) and lets the audit-row pipeline ship the same day as the PDF feature.
3. Create `hooks/use-export-pdf.test.ts`. Mock the dynamic import; assert pending state, success/failure toast paths, error surface, and that the fire-and-forget POST is invoked on success but its failure does not surface a toast.
4. Test passes.

### Step 4 — UI components

1. If `toggle-group.tsx` is missing from `packages/ui`, install via `npx -y shadcn@latest add toggle-group --yes` from `packages/ui` per decision 9. Verify `@radix-ui/react-toggle-group` peer at install time via `pnpm view @radix-ui/react-toggle-group version`; record in PR body.
2. Create `components/export-dialog.tsx` per decisions 2 + 9. Composition: `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription` + body (ToggleGroup) + `DialogFooter` (Cancel + Export buttons). Controlled mode state + `useExportPdf` integration.
3. Create `components/export-button.tsx` per decision 8. Wraps `export-dialog` as its content; the button is the trigger.
4. Create colocated tests for both components per decision 12.
5. `pnpm --filter web-app test --run features/pdf-export/components` — green.

### Step 5 — Route wire-up + log-sheet `id` add

1. Modify `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx` — add `id={`daily-log-sheet-${day.id}`}` to the root SVG per decision 11. One-line change.
2. Update `apps/web-app/src/features/log-sheet/components/daily-log-sheet.test.tsx` — assert the id is present and stable for a given `day.id`. One assertion add.
3. Modify `apps/web-app/src/app/routes/trips-detail.tsx` per decision 8 — add `<ExportButton />` in the TabsList trailing area. The trailing-area pattern is `<div className="ms-auto flex items-center">…</div>` as a sibling of the existing TabsTriggers.
4. Update `apps/web-app/src/app/routes/trips-detail.test.tsx` — assert the Export button renders on both tabs; disabled when `query.isLoading || query.error`.
5. Add `features/pdf-export` to the ESLint feature-allowlist in `apps/web-app/eslint.config.js`. One-way `pdf-export → log-sheet` + `pdf-export → trip-planner` imports allowed.
6. `pnpm --filter web-app test --run` — full FE suite green.

### Step 6 — Local verification + sub-agent reviews

1. `pnpm exec turbo run lint typecheck test --affected` — green.
2. `pnpm format:check` — green.
3. Bundle delta: `pnpm --filter web-app build`. Verify:
   - Entry chunk ≤ +2 KB gzip vs the post-spec-09 baseline (the export button + dialog are eager, but svg2pdf + jsPDF are lazy).
   - A `pdf-export-*.js` lazy chunk exists in `dist/` containing svg2pdf + jsPDF. Expected ~110 KB gzip.
   - No `pdf-export-*.js` preload tag in `dist/index.html` (spec 07 precedent).
     Record exact numbers in PR body.
4. Browser smoke (user's workstation, deferred):
   - Plan a 1-day trip (Richmond → Newark). Open `/trips/<id>`. Click Export. Default mode `Multi-page`. Click Export. PDF downloads as `trip-<8chars>-logs-20260521.pdf`.
   - Open the PDF in Preview / Adobe / Chrome. Confirm: 1 page, §395.8 grid centered, header chrome legible, duty-status lines correct, totals match the screen SVG, signature italic (if "I certify" was checked).
   - Plan a multi-day trip (LA → NYC). Export Multi-page → N pages, each layout pixel-equivalent to on-screen.
   - Export Single-page → 1 long page with all N sheets stacked. Filename has `-singlepage` suffix.
   - Toggle "I certify" off → re-export → signature line empty.
   - Test with sidebar collapsed and on mobile viewport.
   - Verify `prefers-reduced-motion: reduce` → no spinner spin during export.
5. Sub-agent reviews (per `CLAUDE.md` matrix):
   - `typescript-pro` — required: React 19 `useActionState` correctness, dynamic-import typing, zod schema reuse, fire-and-forget POST shape.
   - `ui-visual-validator` — required: Dialog Title + Description, keyboard reachability of toggle + buttons, target sizes, focus management on dialog open/close, `aria-busy` during pending, `prefers-reduced-motion` honored on the spinner.
   - `performance-engineer` — required: bundle delta + lazy-chunk separation + PDF generation latency on a 5-day trip + no manualChunks carve-out (spec 07 anti-pattern check).
   - `code-reviewer` — required.
   - `architect-review` — NOT required on this branch (invariant #6 already strengthened on 10a; 10b touches only FE).
6. Address all CRITICAL + MAJOR findings before opening the PR.

### Step 7 — PR 10b

1. Open the PR against `develop`. Title: `feat(pdf): client-side PDF export, multi-page + single-page (spec 10 phase 2)`. Fill every section of `.github/pull_request_template.md`. Cite svg2pdf.js 2.7.0 + jsPDF 4.2.1 + their official docs URLs per validation discipline. Reference the open-issue/PR link for 10a (so reviewers see the BE pre-merged).
2. Invoke `code-reviewer` + the conditional agents per Step 6. Resolve any CRITICAL / MAJOR findings in follow-up commits on the same branch before merge.

### Phase 3 — FE exports history (branch `feat/10c-exports-history-frontend`, off `develop` after 10b merges)

Order strictly matters here.

#### Step 8 — Lift pagination

1. Move `apps/web-app/src/features/saved-trips/components/saved-trips-pagination.tsx` → `apps/web-app/src/components/data-table/data-table-pagination.tsx`. Rename the component to `DataTablePagination`.
2. Move the colocated test (`saved-trips-pagination.test.tsx` → `data-table-pagination.test.tsx`); update the import paths.
3. Update the one import in `apps/web-app/src/features/saved-trips/components/saved-trips-table.tsx`.
4. Run `pnpm --filter web-app test --run data-table-pagination` — green before continuing.

#### Step 9 — Author `features/exports/`

1. Create `schemas/saved-export.ts` + `schemas/exports-list-response.ts` per decision 25.
2. Create `api/query-keys.ts`, `api/list-exports.ts`, `api/create-export.ts`, `api/delete-export.ts` + colocated tests.
3. **Refactor `features/pdf-export/hooks/use-export-pdf.ts`** to replace the inline `_writeExportRecord` helper with a call to `useCreateExportRecord` from `features/exports/api/create-export.ts`. Update the test mock target accordingly.
4. Create the components: `exports-table.tsx`, `recreate-export-button.tsx`, `delete-export-dialog.tsx`, `exports-empty.tsx`, all with colocated tests.

#### Step 10 — Wire the route + sidebar

1. Add `apps/web-app/src/app/routes/exports-history.tsx` — mirror `trips-history.tsx`, lazy-import the exports-table feature so a new `exports-history-*.js` chunk is created.
2. Add `apps/web-app/src/app/routes/exports-history.test.tsx` — covers loading, empty, populated, pagination, recreate path (with mocked plan fetch), delete path, deleted-trip degradation.
3. Edit `apps/web-app/src/app/router.tsx` — register `{ path: "exports", element: lazy(...) }` matching the `TripsHistoryRoute` pattern.
4. Edit `apps/web-app/src/config/paths.ts` — add `exportsHistory: "/exports"`.
5. Edit `apps/web-app/src/components/app-shell/app-sidebar.tsx` — append a third `<SidebarMenuItem>` AFTER Saved trips, with `History` icon and route `/exports`.
6. Edit `apps/web-app/src/components/app-shell/app-sidebar.test.tsx` — assert all three items, icons, labels, active states.
7. Edit `apps/web-app/src/testing/handlers.ts` — add MSW handlers for the three `/api/exports/` endpoints.
8. Edit `apps/web-app/eslint.config.js`:
   - Add `exports` feature carve-out: `except: ["./exports", "./pdf-export", "./trip-planner"]`.
   - Update the `pdf-export` carve-out (added in Phase 2) to permit `./exports` so `useExportPdf` can import `useCreateExportRecord`.

#### Step 11 — Verification + sub-agent reviews + PR 10c

1. `pnpm exec turbo run lint typecheck test --affected` — green.
2. `pnpm format:check` — green.
3. Bundle delta: `pnpm --filter web-app build`. Verify:
   - Entry chunk ≤ +3 KB gzip vs post-10b baseline.
   - A new `exports-history-*.js` lazy chunk (~25 KB gzip; @tanstack/react-table already deduplicated with saved-trips' chunk via Rolldown natural-split).
   - The `pdf-export-*.js` chunk from Phase 2 is unchanged.
   - No `exports-history-*.js` preload tag in `dist/index.html`.
4. Browser smoke (user's workstation):
   - Plan a trip; click Export PDF → record appears in `/exports`.
   - Click Recreate on the row → same PDF re-downloads with a `-recreated-${HHMMSS}` suffix; NO new audit row is created.
   - Click Delete → row vanishes; user's on-disk PDF is unaffected.
   - Sidebar shows three items; `History` icon is active on `/exports`.
   - Collapse sidebar; verify the History icon stays visible.
   - On `/trips`, delete the trip → revisit `/exports` → row persists with denormalized labels + a "Deleted" Badge; Recreate shows the graceful-degradation toast.
5. Sub-agent reviews on 10c:
   - `typescript-pro` — required: schema typing, lazy-import shape, hook composition.
   - `ui-visual-validator` — required: table semantics, focus management, target sizes for Recreate/Delete, sidebar tooltip parity.
   - `performance-engineer` — required: bundle delta, lazy-chunk separation, no manualChunks anti-pattern.
   - `code-reviewer` — required.
   - `architect-review` — NOT required (no invariant moves on this branch; invariants strengthened on 10a).
6. **Final commit on 10c**: update `context/progress-tracker.md` to mark spec 10 complete across all three phases. List the three branches, summarize trade-offs (font substitution, denormalization, no-shared-DataTable, inline-POST→hook refactor). Move spec 10 from "Next Up" to "Completed".
7. Open PR 10c against `develop`. Title: `feat(web-app): /exports history route + sidebar item (spec 10 phase 3)`. Fill the template. Reference the merged 10a + 10b PRs.
