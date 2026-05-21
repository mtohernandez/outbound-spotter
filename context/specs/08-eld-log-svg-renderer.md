# 08 — §395.8 Daily Log SVG renderer

> Render one FMCSA Driver's Daily Log §395.8 SVG per `LogDay` row from the spec-06 plan envelope. Four duty-status rows (Off Duty / Sleeper Berth / Driving / On Duty Not Driving) inside a 24-hour grid; per-status totals column on the right; Remarks column with a three-tier city/state precedence resolved at render time; canonical FMCSA blank-template chrome (metadata header + signature line + shipping documents block) per `docs/assets/daily-driver-log-blank.png`. Driver legal name pre-filled from Clerk `useUser()`; truck/trailer/carrier/co-driver/shipping fields are interactive but unpersisted in v1 (driver-profile + per-trip-override persistence ships in spec 10). Multi-day trips stack one sheet per `LogDay` below a `<Tabs>` toggle that shares the main area with the spec-07 Leaflet map. Closes the `docs/assesment.md:14` "Daily Log Sheets filled out — need to draw on the log and fill out the sheet, multiple log sheets will be needed for longer trips" deliverable. FE-only — invariants #1 (planner pure), #4 (no client-side HOS math), #5 (ownership-gated), #7 (theme tokens only), #8 (no custom sub-agents), and #9 (specs drive implementation) all hold verbatim.

## Goal

Land the second visual deliverable the assessment grades against. After this spec ships, a signed-in driver who plans a trip lands on `/trips/:id`, sees the Map tab (spec 07) by default, can switch to the Log Sheets tab, and sees one accurate §395.8 daily log per 24-hour period of the trip. The grid + chrome matches the canonical FMCSA blank template (`docs/assets/daily-driver-log-blank.png`); the duty-status line topology matches the John Doe completed example (`docs/assets/example-complete-grid.png` / `docs/assets/example-daily-log-completed.png`). PDF export (spec 09) consumes the same SVG output without modification; reverse-geocoded city/state in Remarks (spec 10) lifts the lowest-precedence fall-through transparently.

Five user-visible additions:

1. **Tabbed main area on `/trips/:id`** — `<Tabs value={view} onValueChange={setView}>` with two `<TabsTrigger>`s: Map (spec 07 content) and Log Sheets (this spec's content). One main-area route, two views; no new URLs. Tab state syncs to `?view=map|logs` via `useSearchParams` so the back button and bookmarks survive. Default `map` when unset. Both `<TabsContent>` panels render simultaneously (CSS `data-[state=inactive]:hidden`, NOT mount/unmount) so the spec-07 Leaflet map's pan/zoom AND the spec-08 ephemeral metadata both survive toggling.

2. **Daily Log Sheet SVG, one per `LogDay`** — canonical FMCSA chrome reproduced faithfully: header row (Month/Day/Year, Total Miles Driving Today, Vehicle Numbers labeled "(SHOW EACH UNIT)", the "ORIGINAL — Submit to carrier within 13 days / DUPLICATE — Driver retains possession for eight days" copies indication); carrier block (Name of carrier(s), Main office address, "I certify that these entries are true and correct" + signature line, Name of co-driver); 24-hour grid with hour markers above and below + 15-minute tick marks (4 per hour); four labeled duty rows (Off Duty / Sleeper Berth / Driving / On Duty Not Driving); per-status Total Hours column on the right (bottom total = 24); Remarks section below the grid with vertically-rotated city/state labels at each duty-change x-coordinate plus a leader line back to the grid; Shipping Documents block ("Pro or Shipping No.", "Shipper & Commodity"); "Use time standard of home terminal" footer; faded recap placeholder. `font-mono` for the grid + tick labels, `font-sans` for chrome labels, `font-display` italic for the rendered signature.

3. **Duty-status line drawing** — for each `LogEvent` on a given day, draws a horizontal solid line on the correct duty row from `start_x` to `start_x + duration_x` with `stroke="currentColor"` (inherits `--foreground`) and `stroke-width: 2`. Vertical transition line at each duty-status change connects `event[i]` row to `event[i+1]` row at the shared x-coordinate. The first event of each day drops a vertical from the top of the grid into its row; the last event extends to the right edge subject to the midnight clamp. Midnight-crossing events split visually at the day boundary (the `LogEvent` row stays single per invariant #2 — the visual split is computed at render time per `LogDay.date`, mirroring the adapter's `_attribute_to_days` semantics from spec 06).

4. **Auto-populated fields** — `LogDay.date` for the header date, `LogDay.total_miles` for Total Miles Driving Today, time-zone display label derived from `TripPlan.home_terminal_tz` (IANA → "Eastern"/"Central"/"Mountain"/"Pacific"/"Alaska"/"Hawaii" lookup), per-status totals from `LogDay.{off_duty_s, sleeper_s, driving_s, on_duty_not_driving_s}`, driver legal name from Clerk `useUser().user.fullName` with a `firstName + lastName` fallback. The bottom row of the totals column reads exactly 24:00 (guaranteed by the adapter math from spec 06 — invariant #2 keeps the per-day rollup sound).

5. **Interactive (unpersisted) fields** — truck/tractor number, trailer number, name of carrier, main office address, co-driver, shipping document number, shipper & commodity, "I certify these entries are true and correct" checkbox + typed-name signature. All render as inline editable inputs styled to match FMCSA blank lines (underline-only border, no full box). State is lifted to the strip-level `<DailyLogSheetsStrip />` — the driver uses the same truck on the same trip, so the values share across the day stack (per the FMCSA paper-log convention; the per-day repetition is paperwork, not different data). State survives tab switches (per addition 1); resets on full route unmount. Persistence (Profile model + per-trip overrides + reverse-geocoded Remarks) is spec 10.

Architecture invariants from `context/architecture.md` hold:

- **#1 (HOS planner pure)** — this spec is FE-only and never touches `web_api/hos/**`; the spec-05 boundary test passes verbatim.
- **#4 (no client-side HOS math)** — duty-status lines + totals come from spec-06 persisted `LogEvent` + `LogDay` rows; the FE never computes timing or status.
- **#5 (ownership-gated)** — the `/api/trips/<id>/plan/` and `/api/trips/<id>/` endpoints already enforce ownership server-side; this spec only consumes.
- **#7 (theme tokens only)** — every fill, stroke, font-family, and color in the SVG resolves to a CSS variable; the `duty-status-grid` test asserts no `#[0-9a-fA-F]{3,8}` literal lands anywhere in the rendered output.
- **#8 (no custom sub-agents)** — the reviews use the wshobson marketplace agents already declared in `.claude/settings.json`.
- **#9 (specs drive implementation)** — this file is the source of truth; the build plan in `context/progress-tracker.md#Next Up` already queues spec 08 by name.

## Decisions of record (resolved at planning time)

Resolved during the spec-08 planning session. Companion plan file: `/Users/mateo/.claude/plans/role-you-are-a-robust-blanket.md`.

1. **Hand-rolled SVG, no library.** Web search 2026-05-20 (queries: `"FMCSA §395.8 daily log SVG renderer javascript npm library 2026"` and `""driver's daily log" "24-hour grid" React component npm hours of service ELD"`) returned only general 24-hour scheduler components (`@full-event-calendar/react`, Mobiscroll Scheduler) which do not match the FMCSA template chrome and would have to be heavily styled anyway. The §395.8 grid is well-defined geometry (1440 minutes × 4 rows + chrome); hand-rolling the SVG mirrors the existing `SpotterLoader` (`packages/ui/src/components/brand/spotter-loader.tsx`) and `marker-icons.tsx` (`apps/web-app/src/features/trip-planner/components/map/marker-icons.tsx`) patterns. Cited search results: <https://www.npmjs.com/package/@full-event-calendar/react>, <https://demo.mobiscroll.com/react/scheduler>; FMCSA regulatory references confirmed no maintained npm package targets §395.8 specifically.

2. **Canonical FMCSA template chrome** — reproduces `docs/assets/daily-driver-log-blank.png` faithfully. Specifics, top-to-bottom:
   - **Header row**: Month / Day / Year inputs, "Total Miles Driving Today" (read-only from `LogDay.total_miles`), "Vehicle Numbers — (SHOW EACH UNIT)" with two editable sub-fields (truck/tractor + trailer), and the side label "ORIGINAL — Submit to carrier within 13 days / DUPLICATE — Driver retains possession for eight days".
   - **Carrier block**: "Name of carrier(s)" editable, "Main office address" editable, "I certify that these entries are true and correct" + signature line, "Name of co-driver" editable.
   - **24-hour grid**: hour markers (Midnight, 1, 2, …, 11, Noon, 13, 14, …, 23) printed both above AND below the grid; four duty rows labeled "Off Duty", "Sleeper Berth", "Driving", "On Duty (Not Driving)"; 4 tick marks per hour cell at 15-minute increments.
   - **Total Hours column**: on the right, four cells (one per duty row) plus a bottom total cell that reads `=24`.
   - **Remarks section**: below the grid, vertically-rotated city/state labels at each duty-change x-coordinate, with a leader line from the label back to the grid (matches `docs/assets/example-complete-grid.png` topology).
   - **Shipping Documents block**: "Pro or Shipping No." and "Shipper & Commodity" editable lines.
   - **Time-zone footer**: literal "Use time standard of home terminal."
   - **Recap block**: faded "Recap — see app summary" placeholder with a `<title>` tooltip explaining the omission (decision 15).

3. **Stacked sheets, vertical strip in date order.** Multiple `LogDay` rows render top-down ascending by date. Each sheet is its own SVG; a date header (`Intl.DateTimeFormat(..., { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: plan.home_terminal_tz })`) renders above each. A 5-day trip → 5 sheets the driver scrolls through. No pagination, no carousel — the FMCSA model is a paper-log stack and the UI mirrors that. The strip lives in an `overflow-y-auto` container; the spec-07 main area already uses native CSS overflow.

4. **One new shadcn primitive: `tabs`.** Install via the existing shadcn workflow in `packages/ui` (mirrors spec 01's primitive-install precedent). Verify the radix peer-dep at install time via `pnpm view @radix-ui/react-tabs version`; record the version in the PR body per `CLAUDE.md` validation discipline. No other primitive additions in this spec; `Field`, `FieldLabel`, `Input`, `Checkbox`, `Button`, `Tooltip` are already installed and used as-is.

5. **Tab persistence via URL search param.** `?view=map|logs` is the single source of truth; default `map` when unset. The `useSearchParams` hook from `react-router` drives the value. Both `<TabsContent>` panels render simultaneously (CSS `data-[state=inactive]:hidden`, NOT mount/unmount) so component state inside both panels — including the spec-07 Leaflet map's pan/zoom AND the spec-08 ephemeral metadata — survives toggling. Tested explicitly: `?view=logs` on initial URL renders the Log Sheets tab on mount; back/forward navigation preserves the tab.

6. **Grid geometry pinned in `features/log-sheet/components/grid-geometry.ts`:**

   ```ts
   export const HOUR_WIDTH = 32; // px per hour cell
   export const ROW_HEIGHT = 24; // px per duty row
   export const GRID_X = 96; // px, left edge of the grid (room for row labels)
   export const GRID_Y = 200; // px, top edge of the grid (room for the header + hour markers)
   export const TICKS_PER_HOUR = 4; // 15-minute increments
   export const MINUTES_PER_DAY = 1440;
   export const GRID_WIDTH = HOUR_WIDTH * 24; // 768 px
   export const GRID_HEIGHT = ROW_HEIGHT * 4; // 96 px
   ```

   Full sheet renders at ~900 × 750 px. Renders crisply at any zoom because SVG. Constants are exported so colocated tests assert geometry without re-deriving.

7. **Pure `time-to-x.ts` coordinate function** at `features/log-sheet/utils/time-to-x.ts`. Signature `(start: Date | string, day: string /* YYYY-MM-DD in home-terminal-local TZ */, hourWidth?: number) => number`. Clamps at the day boundary: a midnight start → 0; a midnight end (i.e., this is the end of the previous day) → `GRID_WIDTH = 768`. Pure, unit-tested with assertions for midnight clamp, mid-day positions, and DST-transition days in `America/New_York`. Spec 06's `_attribute_to_days` adapter pins midnight semantics on the BE; the renderer's clamp mirrors that contract.

8. **Duty-status → row-index map** at `features/log-sheet/components/duty-row-map.ts`:

   ```ts
   import type { DutyStatus } from "@/features/trip-planner/schemas/trip-plan";

   export const DUTY_ROW_INDEX: Record<DutyStatus, 0 | 1 | 2 | 3> = {
     off_duty: 0,
     sleeper_berth: 1,
     driving: 2,
     on_duty_not_driving: 3,
   };
   ```

   Centralized so a future `DutyStatus` enum addition fails type-check in exactly one place. Same discipline as spec 07's `stop-type-colors.ts`.

9. **Vertical transition lines** derived at render time from consecutive event pairs in `LogEvent[]` filtered by day. For each `event[i] → event[i+1]` transition, a vertical line at the shared x-coordinate (end of event[i] = start of event[i+1]) connects the two duty rows. The first event of each day drops a vertical from the top of the grid into its row; the last event of the day extends horizontally to the right edge (or to the midnight clamp). Implemented inside `duty-status-grid.tsx`.

10. **Remarks column data flow — three-tier precedence**, evaluated per duty-change event, implemented in `features/log-sheet/utils/lookup-event-location.ts`:
    1. **Trip-level address labels (highest priority)** — events whose planner `note` starts with `"Pickup"` resolve to `trip.pickup_label` (Pelias-geocoded city + state from spec 03). `"Dropoff"` → `trip.dropoff_label`. The trip's first driving event (sequence 0 + status `driving`) resolves to `trip.current_label`. These three labels are Pelias-stamped at trip-create time and carry city/state by construction.
    2. **`TripStop.label`** if the event maps to a `TripStop` by `polyline_index` proximity AND the label is non-empty. v1 these are empty per spec 07 decision 14; spec 10 fills them via reverse-geocode and this precedence lets the renderer transparently pick the upgrade up with zero changes here.
    3. **Planner `LogEvent.note`** for break / sleeper / restart / fuel events that have no trip-level address — these give the reason the driver writes in Remarks for that duty change (e.g., "30-min break (§395.3(a)(3)(ii))", "Fueling", "10-hour off-duty (§395.3(a)(2))").
    4. **`formatLatLon(lat, lon)` fallback** (re-uses spec 07's util at `apps/web-app/src/features/trip-planner/utils/format-lat-lon.ts`) for events that fail every prior tier.

    The colocated test (`lookup-event-location.test.ts`) asserts the precedence with fixtures that exercise each tier and the fall-through chain.

11. **Driver name pre-fill** from Clerk's `useUser()` hook (Core 3 / `@clerk/react`, already used in spec 03's `NavUser`):

    ```ts
    const { user } = useUser();
    const driverLegalName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";
    ```

    The "Driver" field defaults to this value; the signature line renders the same value italic when "I certify" is checked. Per the `<RequireAuth>` shell, `useUser().user` is guaranteed defined inside the Trips routes; the `||` chain is paranoid but cheap and keeps the renderer safe in test environments where the Clerk mock omits one of the name shapes.

12. **Interactive (unpersisted) fields — `useState<SheetMetadata>` lifted to strip-level.** Truck/tractor #, trailer #, carrier name, main office address, co-driver, shipping doc, shipper & commodity, the `iCertify` boolean, and the signature value (overrides the Clerk default if the driver edits it) all live in one `SheetMetadata` object inside `<DailyLogSheetsStrip />`. Every sheet in the strip reads the same values (per the FMCSA paper-log convention: same truck on the same trip — per-day repetition is paperwork, not different data). State survives tab switches (decision 5) but resets on full route unmount. Spec 10 promotes this to Trip-level columns + a Profile model + a form on the trip-input page; the renderer's prop interface stays stable across that lift.

13. **Typed-name signature, italic.** Renders as `font-family: var(--font-display)` italic on the signature line. The "I certify these entries are true and correct" checkbox gates the rendering: unchecked → empty signature line; checked → the typed name (defaulting to the Clerk legal name) renders italic in the signature slot. Default state is unchecked — the driver affirmatively certifies each session, matching §395.8(a)(7) language. Confirmed by user's plan-mode Q2 selection.

14. **Time-zone display label** at `features/log-sheet/utils/format-tz-label.ts`. `TripPlan.home_terminal_tz` is an IANA string. The util maps the common US zones to display labels:

    ```ts
    America/New_York   → "Eastern"
    America/Chicago    → "Central"
    America/Denver     → "Mountain"
    America/Los_Angeles → "Pacific"
    America/Anchorage  → "Alaska"
    Pacific/Honolulu   → "Hawaii"
    ```

    Anything else falls back to the raw IANA string. The "Use time standard of home terminal." footer renders literal regardless — the display label appears in the header row beside the date.

15. **Recap block is a faded placeholder.** The 70/8 + 60/7 cycle calculation block at the bottom of `docs/assets/daily-driver-log-blank.png` is rendered as a single faded line reading "Recap — see app summary" with a `<title>` tooltip explaining: "The planner enforces §395.3 cycle limits server-side (architecture invariant #4); the manual recap math is omitted to avoid duplicate-source-of-truth drift." A future spec could surface the per-day rolling-cycle totals here if a real driver asks; v1 punts. The planner already enforces §395.3(b) and §395.3(c)(1) — reproducing the driver's manual recap math adds zero compliance value and creates a drift risk between two sources of truth.

16. **No PDF in this spec.** Spec 09 owns PDF export. The SVG output is designed for `svg2pdf.js` consumption: every glyph is a primitive (`<path>`, `<line>`, `<text>`, `<rect>`); zero `foreignObject`, zero external `<image href="…">`, zero CSS Houdini features. The signature input renders to a plain `<text>` element when the "I certify" checkbox is checked. Spec 09 picks up this SVG verbatim and concatenates the strip into a single downloadable PDF.

17. **Browser smoke deferred to user's workstation** (mirrors spec 06 + 07 precedent). The agent lacks Clerk + ORS secrets to run the full pipeline; component-level tests use the MSW `mockTripPlan` handler with a multi-day fixture variant + the `clerk-mocks.ts` `useUser` shim from spec 02. The user verifies the 1-day Richmond → Newark trip and a multi-day LA → NYC trip on their workstation per Sequencing Step 6.

18. **No new BE diff.** This spec consumes `/api/trips/<id>/plan/` and `/api/trips/<id>/` unchanged. The `apps/web-api/**` tree is read-only. The spec-05 boundary test still passes verbatim (no `web_api/hos/**` import added anywhere). No migrations, no view changes, no serializer changes.

19. **`features/log-sheet/**` is a NEW feature folder.** Per spec 03's Bulletproof React import-path rule (`packages/eslint-config/react.js#import-x/no-restricted-paths`), the new feature gets the same boundary as `features/trip-planner/**`: it may import from `components/`, `hooks/`, `lib/`, `types/`, `utils/`, `stores/`, `config/`, AND from `features/trip-planner/**`for the shared zod types +`formatLatLon` util (which are presentation-layer primitives, not cross-feature business logic). The eslint config carve-out is updated to add the new feature's name to the allowlist (a one-line edit per existing pattern); the trip-planner → log-sheet import direction stays one-way (log-sheet imports trip-planner types and the lat/lon formatter, never the reverse).

20. **SVG accessibility floor** — each `<svg>` has a `<title>` (e.g., "Daily Log — Tuesday, May 20, 2026") and a `<desc>` summarizing the totals ("Off Duty 10.0h · Sleeper Berth 0.0h · Driving 7.75h · On Duty Not Driving 6.25h · Total 24.0h"). The `aria-labelledby` and `aria-describedby` attributes point at these inline elements. Per `context/ui-context.md#Accessibility floor`: "ELD log SVGs: include `<title>` and `<desc>` per chart so screen readers can announce the day summary." The `ui-visual-validator` sub-agent will assert this; the colocated test (`daily-log-sheet.test.tsx`) also asserts the elements exist.

## Decisions amended post-implementation

Filled in if/when live-test surfaces a behavior the spec did not anticipate. Empty at write time.

## Scope

### In

**`packages/ui` — one shadcn primitive:**

- `pnpx shadcn@latest add tabs` in `packages/ui` (or the workspace-aware equivalent; verify the exact flag at install time). Lands `packages/ui/src/components/tabs.tsx`. Confirm `packages/ui/package.json#exports` resolves `./components/tabs` via the existing `./components/*` → `./src/components/*.tsx` pattern key.
- `packages/ui/package.json` — the shadcn CLI may add `@radix-ui/react-tabs` as a peer/runtime dep; verify pinned version via `pnpm view @radix-ui/react-tabs version` and record in PR body.

**`apps/web-app` — new feature `features/log-sheet/**`:\*\*

- `features/log-sheet/components/daily-log-sheet.tsx` (NEW) — single SVG renderer per `LogDay`. Props `{ day, events, stops, trip, homeTerminalTz, driverName, metadata, onMetadataChange }`. Output: one full §395.8 SVG document with `role="img"`, `aria-labelledby`, `aria-describedby`, inline `<title>` + `<desc>` per decision 20.
- `features/log-sheet/components/daily-log-sheets-strip.tsx` (NEW) — composition root for the Log Sheets tab. Lifts `useState<SheetMetadata>`; iterates `plan.days` ascending by date; renders one `<DailyLogSheet>` per day with a date header.
- `features/log-sheet/components/duty-status-grid.tsx` (NEW) — the 24h × 4-row SVG geometry (hour markers above + below, tick marks, row labels, duty-status line drawing).
- `features/log-sheet/components/log-sheet-header.tsx` (NEW) — date / total miles / vehicle / carrier / driver header block. Reads Clerk `useUser()`. Uses `editable-line.tsx` for the unpersisted fields.
- `features/log-sheet/components/log-sheet-footer.tsx` (NEW) — Shipping Documents block + signature line + faded recap placeholder with `<title>` tooltip per decision 15.
- `features/log-sheet/components/remarks-column.tsx` (NEW) — vertically-rotated text labels at each duty-change x-coordinate, using `lookup-event-location` per decision 10.
- `features/log-sheet/components/totals-column.tsx` (NEW) — four per-status totals on the right + bottom 24h total row.
- `features/log-sheet/components/signature-field.tsx` (NEW) — `Field` + `FieldLabel` + `Checkbox` + `Input`; renders italic typed name on the signature line when checked per decision 13.
- `features/log-sheet/components/editable-line.tsx` (NEW) — `<Input>` styled to a FMCSA blank-line (underline-only border; `<FieldLabel sr-only>` for accessibility). Reused across truck/trailer/carrier/co-driver/shipping fields.
- `features/log-sheet/components/grid-geometry.ts` (NEW) — pixel constants per decision 6.
- `features/log-sheet/components/duty-row-map.ts` (NEW) — `DUTY_ROW_INDEX` per decision 8.
- `features/log-sheet/utils/time-to-x.ts` (NEW) — pure coordinate function per decision 7.
- `features/log-sheet/utils/events-by-day.ts` (NEW) — splits `LogEvent[]` into per-`LogDay` render fragments, handling midnight crossings without mutating the source rows (mirrors spec 06 `_attribute_to_days` contract).
- `features/log-sheet/utils/format-tz-label.ts` (NEW) — IANA → display label per decision 14.
- `features/log-sheet/utils/format-seconds.ts` (NEW) — `(seconds: number) => "10h 45m"` for the totals column.
- `features/log-sheet/utils/lookup-event-location.ts` (NEW) — three-tier precedence per decision 10.
- `features/log-sheet/types/sheet-metadata.ts` (NEW) — `SheetMetadata` TS interface (all unpersisted fields + `iCertify` boolean).
- `app/routes/trips-detail.tsx` (MODIFY) — wrap the existing main-area content in `<Tabs value={view} onValueChange={(v) => setSearchParams({ view: v })}>` with two `<TabsContent>` panels (Map / Log Sheets). `view` reads from `useSearchParams`; default `map`. Both panels render simultaneously (CSS `data-[state=inactive]:hidden`) per decision 5.
- `apps/web-app/eslint.config.js` (MODIFY) — add `features/log-sheet` to the existing feature-allowlist carve-out for `import-x/no-restricted-paths` (one-line edit per spec 03 pattern; one-way import from log-sheet → trip-planner types/utils stays explicit).

**Tests (mandatory minimum, colocated):**

- `features/log-sheet/components/daily-log-sheet.test.tsx` (NEW) — renders the canonical chrome; date / miles / totals reflect the `LogDay`; duty-status line geometry against a fixture; midnight-crossing event clamps at the day boundary; `<title>` + `<desc>` present.
- `features/log-sheet/components/duty-status-grid.test.tsx` (NEW) — 24 hour markers above + 24 below; 4 duty rows; horizontal line on the correct row per event; vertical transitions at duty-status changes; no hex literals in output (assert `/#[0-9a-fA-F]{3,8}/` does NOT match any inline `style`, `fill`, or `stroke` attribute).
- `features/log-sheet/components/daily-log-sheets-strip.test.tsx` (NEW) — one sheet per `LogDay`; date headers present; ascending date order; metadata state lifted (typing into truck# on sheet 1 reflects on sheet 2 via shared `useState`).
- `features/log-sheet/components/remarks-column.test.tsx` (NEW) — three-tier precedence asserted: trip-level label > TripStop.label > planner note > `formatLatLon`.
- `features/log-sheet/components/totals-column.test.tsx` (NEW) — four per-status values match `LogDay.*_s` formatted via `format-seconds`; bottom row = `24h 0m`.
- `features/log-sheet/components/signature-field.test.tsx` (NEW) — empty signature when "I certify" unchecked; typed name renders italic when checked; accessible label on the checkbox; `aria-describedby` chain to any helper text.
- `features/log-sheet/components/log-sheet-header.test.tsx` (NEW) — driver name pulled from Clerk mock; date format matches FMCSA template; total miles format matches; editable inputs render for vehicle / carrier / co-driver.
- `features/log-sheet/components/log-sheet-footer.test.tsx` (NEW) — Shipping Documents fields render as editable lines; signature line; recap placeholder has the `<title>` tooltip text from decision 15.
- `features/log-sheet/components/editable-line.test.tsx` (NEW) — renders as underline-only input; placeholder shows when empty; `sr-only` label is in the accessibility tree.
- `features/log-sheet/utils/time-to-x.test.ts` (NEW) — midnight clamp (start-of-day → 0, end-of-day → 768); mid-day positions; DST-transition day positions in `America/New_York`.
- `features/log-sheet/utils/events-by-day.test.ts` (NEW) — midnight-crossing event splits into two render fragments; source `LogEvent[]` stays unmutated; per-day fragments preserve `start_at` + `duration_s` semantics.
- `features/log-sheet/utils/format-seconds.test.ts` (NEW) — `0 → "0h 0m"`, `3600 → "1h 0m"`, `5400 → "1h 30m"`, `86400 → "24h 0m"`.
- `features/log-sheet/utils/format-tz-label.test.ts` (NEW) — six known zones map to display labels; unknown zones pass through unchanged.
- `features/log-sheet/utils/lookup-event-location.test.ts` (NEW) — precedence + fallbacks against fixture trip + events + stops.
- `app/routes/trips-detail.test.tsx` (UPDATE) — `<Tabs>` renders both panels; default tab is Map; switching to Log Sheets renders the strip with the right number of sheets; switching back preserves the spec-07 Map's React state and the metadata edits; `?view=logs` initial URL renders the Log Sheets tab on mount.

**MSW fixture extension:**

- `apps/web-app/src/testing/handlers.ts` (MODIFY) — extend `mockTripPlan` to optionally emit a multi-day envelope (3+ `LogDay` rows + matching event/stop counts; LA → Phoenix → Albuquerque-style 3-day fixture) for the strip tests. The existing single-day default stays the default; the variant is opt-in via a parameter.

### Out (deferred to listed specs)

- **PDF export** → spec 09. The SVG output is structured for `svg2pdf.js` consumption per decision 16.
- **Reverse-geocoded city/state in Remarks** → spec 10 (driver profile + metadata persistence). v1 uses the three-tier precedence in decision 10; the renderer transparently picks up `TripStop.label` when spec 10 fills it.
- **Persistent driver/vehicle/carrier metadata + per-trip overrides** → spec 10. v1 uses ephemeral component state per decision 12.
- **Driver Profile model (per-Clerk-user defaults)** → spec 10.
- **Drawn (canvas) signature** → not planned. User explicitly selected typed-name + "I certify" in plan-mode Q2; the signature renders italic via `font-display` per decision 13.
- **70/8 + 60/7 recap calculation block** → not planned. The planner enforces cycle limits server-side per architecture invariant #4; reproducing the manual recap math adds no compliance value and would create a duplicate-source-of-truth drift risk (decision 15).
- **Inline log edit that mutates `LogEvent` rows** → not planned, ever. The FE never authors LogEvents per architecture invariant #4.
- **Print stylesheets (`@media print`)** → spec 09 (PDF) supersedes.
- **Saved trips list** → future spec (also called out in spec 07's Out section).
- **§395.1(g) split-sleeper pairing visual indicators** → tied to its parent spec (per spec 05 decision 9, also called out in spec 07).
- **Re-plan on `start_at` edit** → future spec (called out in spec 07's Out section).
- **Custom font for the signature** → not planned. The `font-display` (Geologica) italic from `ui-context.md` is sufficient; a script-style font would be a brand departure.

## Prerequisites (already true)

- Spec 06 is merged on `develop`. `GET /api/trips/<uuid:id>/plan/` returns `{trip_id, start_at, home_terminal_tz, stops, events, days}` per the spec-06 envelope. Invariant #2 (one `LogEvent` row per duty-status change; midnight splits are denormalized into `log_days` only) holds; adapter midnight semantics live in `apps/web-api/web_api/apps/trips/hos_adapter.py::_attribute_to_days`.
- Spec 07 is merged on `develop`. `/trips/:id` exists; `<TripMap />` renders in the main area under `<Suspense fallback={<SpotterLoader size="lg" />}>`; `useTripPlan(tripId)` lives at `apps/web-app/src/features/trip-planner/api/trip-plan.ts`; `useTripById(tripId)` lives at `apps/web-app/src/features/trip-planner/api/use-trip-by-id.ts`; `tripPlanSchema` zod types live at `apps/web-app/src/features/trip-planner/schemas/trip-plan.ts`; `formatLatLon` util at `apps/web-app/src/features/trip-planner/utils/format-lat-lon.ts`; MSW `mockTripPlan` handler emits a canned envelope.
- `packages/ui` ships `Field`, `FieldLabel`, `Input`, `Checkbox`, `Button`, `SidebarGroup`, `SidebarGroupLabel`, `Skeleton`, `Empty`, `Badge`, `Card`, `Separator`, `Tooltip`. `Tabs` is the lone new install in this spec.
- Clerk `useUser()` is in place via spec 02 / spec 03. The web-app's `<RequireAuth>` shell guarantees `useUser().user` is defined inside the Trips routes; the `||` fall-through in decision 11 keeps test environments safe.
- `Intl.DateTimeFormat` + `--font-sans` + `--font-mono` + `--font-display` tokens are wired in `packages/ui/src/styles/globals.css`. No theme additions in this spec.
- `Trip.current_label` / `Trip.pickup_label` / `Trip.dropoff_label` are Pelias-geocoded strings (city + state) populated by spec 03's address resolver. The renderer reads them via `useTripById(tripId).data`, which is already cached at the route level by spec 07.
- The Bulletproof React `import-x/no-restricted-paths` carve-out for `features/trip-planner` is in place per spec 03; the new `features/log-sheet` carve-out is a one-line addition per the existing pattern.
- `package.json#browserslist` covers `Intl.DateTimeFormat` with `timeZone:` modern-browser baseline.
- The `apiFetch<T>` + `ApiError` infrastructure + the MSW harness exist; the colocated `Vitest` + RTL setup from spec 01 covers the new component tests.

## Boundary

- Touches `packages/ui/src/components/tabs.tsx` (installed via the shadcn CLI; do not hand-edit — CLI re-run is the update path per `context/code-standards.md`).
- May touch `packages/ui/package.json` (the shadcn install may add `@radix-ui/react-tabs` peer/runtime dep; pin verified via `pnpm view` at install time).
- Touches `apps/web-app/src/features/log-sheet/**` (NEW feature folder + colocated tests; ~20 files: components + utils + types + tests).
- Touches `apps/web-app/src/app/routes/trips-detail.tsx` (wrap in `<Tabs>` + `?view=` search-param sync).
- Touches `apps/web-app/src/app/routes/trips-detail.test.tsx` (update assertions for the Tabs wrap + Log Sheets tab).
- Touches `apps/web-app/src/testing/handlers.ts` (extend `mockTripPlan` with a multi-day variant; no signature change to the default).
- Touches `apps/web-app/eslint.config.js` (one-line feature-allowlist edit for `features/log-sheet`).
- Touches `context/progress-tracker.md` (post-implementation, last commit).
- Does **NOT** touch `apps/web-api/**`. The plan endpoint shipped in spec 06; this spec consumes it read-only.
- Does **NOT** touch `apps/web-api/web_api/hos/**` — the spec-05 boundary test (`apps/web-api/tests/hos/test_boundary.py`) passes verbatim.
- Does **NOT** touch `apps/web-auth/**`, `packages/eslint-config/**`, `packages/typescript-config/**`, `docs/**`, `.github/**`, `.husky/**`, `turbo.json`.
- Does **NOT** touch `apps/web-app/src/features/trip-planner/**` — the trip-planner feature stays as spec 07 shipped it; the Tabs wrap happens at the route level, not inside trip-planner. The log-sheet feature imports trip-planner types + `formatLatLon` one-way.

**Boundary is FE-only, single-system.** Mirrors spec 07's discipline. No FE+BE vertical-slice deviation.

## Sequencing

Order: shadcn Tabs install first; pure utils + types second so the data flow is fully tested in isolation; SVG primitives third; sheet composition + strip fourth; route wire-up fifth; verification + sub-agent reviews sixth; progress tracker + PR seventh.

### Step 1 — shadcn Tabs primitive

1. Verify upstream `@radix-ui/react-tabs` current version via `pnpm view @radix-ui/react-tabs version`. Record in PR body per `CLAUDE.md` validation discipline.
2. Install via the shadcn CLI in `packages/ui` (workflow per spec 01). Confirm `packages/ui/src/components/tabs.tsx` lands; do NOT hand-edit it.
3. Confirm `packages/ui/package.json#exports` resolves `./components/tabs` → `./src/components/tabs.tsx` via the existing pattern key (no manual export additions needed).
4. `pnpm exec turbo run typecheck --filter ui` — must pass.

### Step 2 — Pure utils + types

1. Create `apps/web-app/src/features/log-sheet/types/sheet-metadata.ts` with the `SheetMetadata` interface (truck/tractor number, trailer number, carrier name, carrier main office address, co-driver, shipping doc number, shipper-and-commodity, `iCertify: boolean`, optional `signatureOverride: string` for when the driver edits away from the Clerk default).
2. Create `apps/web-app/src/features/log-sheet/components/grid-geometry.ts` with the pixel constants per decision 6.
3. Create `apps/web-app/src/features/log-sheet/components/duty-row-map.ts` per decision 8.
4. Create utils with colocated tests (each 10–30 LOC pure function with 3–6 assertions):
   - `utils/time-to-x.ts` + `time-to-x.test.ts`
   - `utils/events-by-day.ts` + `events-by-day.test.ts`
   - `utils/format-seconds.ts` + `format-seconds.test.ts`
   - `utils/format-tz-label.ts` + `format-tz-label.test.ts`
   - `utils/lookup-event-location.ts` + `lookup-event-location.test.ts`
5. Add `features/log-sheet` to the eslint feature-allowlist (one-line edit in `apps/web-app/eslint.config.js`; mirrors spec 03's pattern). The one-way log-sheet → trip-planner import for types + `formatLatLon` is allowed.
6. `pnpm --filter web-app test --run features/log-sheet/utils` — green.

### Step 3 — Grid + chrome SVG components

1. Create `components/duty-status-grid.tsx` rendering the 24-hour × 4-row SVG geometry: hour markers above + below (Midnight, 1, …, 23); 4 tick marks per hour cell; row labels in `font-mono`; duty-status line drawing pulls from the day's events via `events-by-day` + `time-to-x` + `duty-row-map`. `stroke="currentColor"` cascading from the parent SVG's `color: var(--foreground)`.
2. Create `components/totals-column.tsx` — four per-status totals (one per row) formatted via `format-seconds`; bottom total row reads `24h 0m`.
3. Create `components/remarks-column.tsx` — vertical text labels (`transform="rotate(-60 x y)"` or `writing-mode: vertical-rl` per implementer pick) at each duty-change x-coordinate, using `lookup-event-location`; leader line back to the grid.
4. Create `components/log-sheet-header.tsx` — date / miles / vehicle / carrier / driver header block. Reads Clerk `useUser()` per decision 11. Uses `editable-line.tsx` for the unpersisted fields.
5. Create `components/log-sheet-footer.tsx` — Shipping Documents block (Pro or Shipping No., Shipper & Commodity) + signature line + faded recap placeholder with `<title>` tooltip per decision 15.
6. Create `components/signature-field.tsx` — `Field` + `FieldLabel` + `Checkbox` + `Input`; renders italic typed name in the signature slot when `iCertify` is true per decision 13.
7. Create `components/editable-line.tsx` — `<Input>` styled to a FMCSA blank line (border-bottom only; no border on top/left/right). `<FieldLabel sr-only>` for accessibility. Reused across truck/trailer/carrier/co-driver/shipping fields.
8. `pnpm --filter web-app test --run features/log-sheet/components` — green.

### Step 4 — Sheet composition + strip

1. Create `components/daily-log-sheet.tsx` composing header + grid + remarks + totals + footer into one SVG document. Top-level `<svg role="img" aria-labelledby={titleId} aria-describedby={descId}>` with `<title>` + `<desc>` per decision 20. SVG viewBox sized to ~900 × 750 px per decision 6.
2. Create `components/daily-log-sheets-strip.tsx`:
   - Receives `{ trip, plan }` as props from the route (no hook re-fetch).
   - Reads `driverName` via `useUser()` per decision 11.
   - `useState<SheetMetadata>` lifted at this level per decision 12; the `setMetadata` updater is passed down to each `<DailyLogSheet />`.
   - Iterates `plan.days` ascending by date; renders one `<DailyLogSheet />` per day; renders a date header above each (`Intl.DateTimeFormat(..., { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: plan.home_terminal_tz })`).
   - Container is `<div className="overflow-y-auto …">` per decision 3.
3. `pnpm --filter web-app test --run features/log-sheet` — green; multi-day fixture renders N sheets with correct totals + duty-status line geometry.

### Step 5 — Route wire-up via Tabs

1. Modify `apps/web-app/src/app/routes/trips-detail.tsx`:
   - Read `view` from `useSearchParams()` (default `map`).
   - Replace the existing single-pane main area with `<Tabs value={view} onValueChange={(v) => setSearchParams({ view: v })}>` + `<TabsList>` (Map / Log Sheets) + two `<TabsContent value="map">` (the existing `<Suspense><TripMap …/></Suspense>` block) and `<TabsContent value="logs">` (the new `<DailyLogSheetsStrip trip={trip.data} plan={plan.data} />`).
   - Both `<TabsContent>` panels MUST render simultaneously (CSS `data-[state=inactive]:hidden`) so the Map's pan/zoom AND the metadata state survive toggling per decision 5.
2. Update `apps/web-app/src/app/routes/trips-detail.test.tsx`:
   - Default render shows the Map tab content.
   - Switching to Log Sheets renders the strip with the right number of sheets.
   - Switching back to Map and back again preserves both the metadata edits and the spec-07 Map's component state.
   - `?view=logs` initial URL renders the Log Sheets tab on mount.
3. Extend `apps/web-app/src/testing/handlers.ts` `mockTripPlan` with a `multiDay()` variant returning 3 `LogDay` rows + matching event/stop counts (LA → Phoenix → Albuquerque-style 3-day fixture). Pure data-shape extension; no MSW handler signature change.
4. `pnpm --filter web-app test --run` — full FE suite passes.

### Step 6 — Local verification + sub-agent reviews

1. `pnpm exec turbo run lint typecheck test --affected` — green.
2. `pnpm format:check` — green.
3. Bundle delta check: `pnpm --filter web-app build` and compare entry chunk size vs the spec-07 baseline (758.04 KB raw / 231.80 KB gzip). The `features/log-sheet/**` module is eagerly imported (no `React.lazy` boundary — log-sheet is a sibling primary content on the same route). Acceptable delta: ≤ +15 KB gzip on the entry chunk. Record exact numbers in the PR body.
4. Browser smoke (user's workstation, deferred per spec 07 precedent):
   - Plan a 1-day trip (Richmond → Newark, 0 cycle hours); confirm Log Sheets tab renders 1 sheet matching `docs/assets/example-complete-grid.png` topology (pre-trip on-duty, drive, fuel on-duty, drive, lunch off-duty, drive, delivery on-duty, drive, sleeper, drive, post-trip on-duty).
   - Plan a multi-day trip (LA → NYC, 0 cycle hours); confirm Log Sheets tab renders N sheets with date headers and each day's totals summing to 24h.
   - Type into truck / carrier / co-driver fields on sheet 1; switch to Map tab and back; values persist (decision 5 + 12).
   - Toggle "I certify"; signature renders italic on the signature line (decision 13).
   - Refresh the page; values reset (v1 ephemeral behavior — documented in decision 12).
5. Sub-agent reviews (per `CLAUDE.md` matrix):
   - `code-reviewer` (`comprehensive-review`) — required.
   - `typescript-pro` (`javascript-typescript`) — required, React 19 + new feature folder.
   - `ui-visual-validator` (`accessibility-compliance`) — required: SVG `<title>` + `<desc>` per decision 20, keyboard reachability of editable fields + checkbox, contrast on duty-status lines, target-size on "I certify" checkbox.
   - `performance-engineer` (`application-performance`) — required: bundle delta, SVG render cost for multi-day trips, `useState` hoisting cost.
   - `architect-review` — invoked ONLY if a decision-of-record moves an invariant; for this spec, no invariant moves (FE-only, theme tokens only, no client-side HOS math).
6. Address all CRITICAL + MAJOR findings before opening the PR.

### Step 7 — Progress tracker + PR

1. Append the "Completed" entry to `context/progress-tracker.md` mirroring the spec-07 entry format (date, branch, summary of what shipped, test count delta, sub-agent reviews + resolutions, key trade-offs).
2. Update "Next Up": spec 09 (PDF export) moves to position 1; add spec 10 (driver/profile model + per-trip metadata overrides + reverse-geocoded Remarks) as the new position 2. Re-number the rest of the queue.
3. `gh pr create --base develop --head feat/08-eld-log-svg-renderer` with `.github/pull_request_template.md` filled per `CONTRIBUTING.md` (Summary citing this spec, Type=feat, validated against live upstream docs for any new fact, sub-agent checkboxes ticked).
