# 10 — Client-side PDF export: multi-page (default) + opt-in single-page

> Closes success criterion #6 from `context/project-overview.md` — "Logs can be exported to a single PDF entirely client-side (no Chromium in production)." Adds a one-click "Export PDF" button to the spec-07/08 `/trips/<uuid>` route that takes the spec-08 §395.8 SVG output and concatenates it into a downloadable PDF via `svg2pdf.js@2` + `jsPDF@4`. Two render paths: default is **multi-page** (one §395.8 sheet per US Letter page, FMCSA-printing style), and an opt-in **single-page** mode stacks every day's sheet onto one tall composite page. Mode toggle lives in an export dialog. Zero backend changes — the SVG produced by spec 08 is intentionally PDF-friendly (viewBox-based, no `<foreignObject>`, primitives-only), so the export pass is purely client-side per architecture invariant #6. Sibling spec to Spec 09 (Saved Trips); both close the assessment-readiness criteria.

## Goal

After this spec ships, the driver viewing `/trips/<uuid>` (on either the Map tab or the Log Sheets tab) clicks "Export PDF" in the route header, picks Multi-page or Single-page in a dialog, and a PDF downloads into the browser. The PDF preserves the §395.8 layout pixel-for-pixel — same grid geometry, same duty-status line topology, same Remarks city/state labels, same totals, same signature italic, same metadata header — relative to the on-screen SVG the driver was reviewing. No server round-trip; no Chromium; no PDF persisted server-side. FE-only.

Four user-visible additions:

1. **"Export PDF" button** in the route header on `/trips/<uuid>` — a shadcn `Button` (`variant="outline" size="sm"` to match the existing Tabs density) with a `lucide-react` `FileDown` icon in the `data-icon` slot. Mounted in the TabsList area (currently bare per spec 08); visible on both Map and Log Sheets tabs.
2. **Export dialog** — shadcn `Dialog` (already installed; not `AlertDialog`, since this is not destructive). Title "Export PDF". Body holds a `ToggleGroup type="single"` with two options ("Multi-page" / "Single-page") per `context/ui-context.md` rule "Option sets (2–7 choices) use ToggleGroup, not a button row." Default `multi-page`. Footer holds Cancel + Export buttons. The Export button shows `aria-busy="true"` + a `Loader2` icon + disabled state while rendering.
3. **Multi-page render path** — one US Letter portrait page per `LogDay`. Each page renders the spec-08 SVG verbatim (header chrome + grid + remarks + totals + footer + signature). Page-break is one log per page; matches how an FMCSA inspector or a carrier expects a paper log book to print.
4. **Single-page render path** — all `LogDay` sheets stacked vertically on one custom-height Letter-width page. Useful for at-a-glance review or sharing a multi-day trip in a single document. The viewport height is `N × sheetHeight + (N - 1) × gutter + topMargin + bottomMargin`.

After download the dialog closes and a `sonner` toast announces "Exported <filename>". On failure the toast shows the error and the dialog stays open so the driver can retry.

Architecture invariants from `context/architecture.md` hold:

- **#1 (HOS planner pure)** — zero touch on `web_api/hos/**`; the spec-05 boundary test passes verbatim.
- **#4 (no client-side HOS math)** — the renderer reads persisted `LogEvent` + `LogDay` rows from the spec-06 plan envelope; nothing about the PDF pass touches duty-status math.
- **#5 (ownership)** — N/A (no API call).
- **#6 (PDF export client-only)** — load-bearing here. No `puppeteer`, `headless-chrome`, `playwright`, `weasyprint`, or any other server-side PDF tool is added. PDF generation runs in the same browser session that rendered the SVG; the user's machine is the only PDF source.
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

## Scope

### In

**`apps/web-app` — new feature `features/pdf-export/**`:\*\*

- `apps/web-app/package.json` (MODIFY) — add `svg2pdf.js@^2.7.0` and `jspdf@^4.2.1` to dependencies.
- `apps/web-app/src/features/pdf-export/lib/render-trip-pdf.ts` (NEW) — orchestrator. Exports `renderTripPdf(plan, trip, metadata, mode): Promise<Blob>`. Per decisions 5 + 6.
- `apps/web-app/src/features/pdf-export/lib/clone-svg-for-export.ts` (NEW) — `cloneSvgForExport(svgEl): SVGSVGElement` per decision 3.
- `apps/web-app/src/features/pdf-export/lib/filename.ts` (NEW) — `buildPdfFilename(tripId, mode, now?): string` per decision 7.
- `apps/web-app/src/features/pdf-export/hooks/use-export-pdf.ts` (NEW) — React 19 `useActionState`-based hook per decision 10.
- `apps/web-app/src/features/pdf-export/components/export-button.tsx` (NEW) — the TabsList button per decision 8.
- `apps/web-app/src/features/pdf-export/components/export-dialog.tsx` (NEW) — the mode-toggle dialog per decisions 2 + 9.
- `apps/web-app/src/features/pdf-export/types/export-mode.ts` (NEW) — `type ExportMode = "multi-page" | "single-page"` + `EXPORT_MODES` const.
- All NEW files have colocated `.test.{ts,tsx}` siblings per decision 12.
- `apps/web-app/src/app/routes/trips-detail.tsx` (MODIFY) — mount the `<ExportButton />` in the TabsList trailing area per decision 8.
- `apps/web-app/src/app/routes/trips-detail.test.tsx` (UPDATE) — assert the Export button renders; disabled-state coverage.
- `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx` (MODIFY) — add `id={`daily-log-sheet-${day.id}`}` to the root SVG per decision 11.
- `apps/web-app/src/features/log-sheet/components/daily-log-sheet.test.tsx` (UPDATE) — assert the new id.
- `apps/web-app/eslint.config.js` (MODIFY) — add `features/pdf-export` to the feature-allowlist carve-out (one-line edit). One-way import from `pdf-export → log-sheet` (to read the `DailyLogSheet` id contract + grid geometry constants) + `pdf-export → trip-planner` (for schemas) is allowed.

**`packages/ui` — possibly one shadcn primitive:**

- `packages/ui/src/components/ui/toggle-group.tsx` (NEW via shadcn CLI per decision 9, ONLY IF NOT ALREADY INSTALLED). Verify at install time; if present, omit this step and update the boundary section.

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
- **Saving exports to a Trip column** → not planned. Per invariant #6, no blob storage; the PDF lives in the user's downloads folder only.

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

- Touches `apps/web-app/src/features/pdf-export/**` (NEW feature folder + colocated tests; ~14 files total).
- Touches `apps/web-app/src/app/routes/trips-detail.tsx` + `trips-detail.test.tsx` (Export button mount).
- Touches `apps/web-app/src/features/log-sheet/components/daily-log-sheet.tsx` (one-line `id` attribute add per decision 11).
- Touches `apps/web-app/src/features/log-sheet/components/daily-log-sheet.test.tsx` (one assertion add).
- Touches `apps/web-app/package.json` (`svg2pdf.js`, `jspdf`).
- Touches `apps/web-app/eslint.config.js` (one-line carve-out).
- May touch `packages/ui/src/components/ui/toggle-group.tsx` (NEW only if not already installed).
- Touches `context/progress-tracker.md` (post-implementation, last commit).
- Does **NOT** touch `apps/web-api/**` — pure FE spec, invariant #6.
- Does **NOT** touch `apps/web-api/web_api/hos/**` — spec-05 boundary test passes verbatim.
- Does **NOT** touch `apps/web-auth/**`, `packages/eslint-config/**`, `packages/typescript-config/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.
- Does **NOT** touch `apps/web-app/src/features/saved-trips/**` (spec 09 surface; sibling spec).
- Does **NOT** touch `apps/web-app/src/features/trip-planner/**` beyond zod schema re-imports.
- Does **NOT** add a migration.

**Boundary is FE-only, single-system.** Mirrors spec 07 + 08 discipline.

## Sequencing

Order: deps install + version verify first; pure lib utilities second (orchestrator, clone, filename); hook third; UI components fourth; route wire-up + log-sheet `id` add fifth; verification + sub-agent reviews sixth; progress tracker + PR seventh.

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
2. Create `hooks/use-export-pdf.test.ts`. Mock the dynamic import; assert pending state, success/failure toast paths, error surface.
3. Test passes.

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
   - `code-reviewer` — required.
   - `typescript-pro` — required: React 19 `useActionState` correctness, dynamic-import typing, zod schema reuse.
   - `ui-visual-validator` — required: Dialog Title + Description, keyboard reachability of toggle + buttons, target sizes, focus management on dialog open/close, `aria-busy` during pending, `prefers-reduced-motion` honored on the spinner.
   - `performance-engineer` — required: bundle delta + lazy-chunk separation + PDF generation latency on a 5-day trip + no manualChunks carve-out (spec 07 anti-pattern check).
   - `architect-review` — NOT required (no invariant moves; FE-only; theme tokens only; no schema change). Document this in the PR body explicitly.
6. Address all CRITICAL + MAJOR findings before opening the PR.

### Step 7 — Progress tracker + PR

1. Append the "Completed" entry to `context/progress-tracker.md` mirroring spec 08's entry format (date, branch, summary, test count delta, bundle delta, sub-agent reviews + resolutions, key trade-offs including the font-substitution decision 4). Move spec 10 from "Next Up" to "Completed".
2. Open the PR against `develop`. Title: `feat(web-app): client-side PDF export, multi-page + single-page (spec 10)`. Fill every section of `.github/pull_request_template.md`. Cite svg2pdf.js 2.7.0 + jsPDF 4.2.1 + their official docs URLs per validation discipline.
3. Invoke `code-reviewer` + the conditional agents per step 6. Resolve any CRITICAL / MAJOR findings in follow-up commits on the same branch before merge.
