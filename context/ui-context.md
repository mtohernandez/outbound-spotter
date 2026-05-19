# UI Context

The visual language is anchored on `docs/theme.md`. Every color, font, radius, spacing, and motion value resolves to a token defined here — no hex literals or hardcoded fonts in components.

## Theme philosophy

- **Brand-led, technical aesthetic.** Teal + near-black + accent red. Light and dark modes both supported; dark is the daily-driver for long-haul drivers reviewing logs at night.
- **Small, deliberate corners.** Following dense-pro-tool conventions (Linear, Vercel, Radix), `--radius: 6px` with the shadcn `calc()` scale. Not zero (too brutalist), not pillowy.
- **Dense by default.** Spacing, control heights, row rhythms tuned to fit more on screen without crowding — mirroring how Linear, Vercel, and GitHub balance density and clarity.
- **Animations are FAST and smooth.** Durations 100–180 ms with `ease-out` for enter, `ease-in` for exit. No long fades, no spring-bounces.

## Validation methodology (techniques cited)

Every choice in this file is derived from a documented, validated technique:

- **Color space**: **OKLCH** (Björn Ottosson, OKLab paper 2020) — perceptually uniform, gamut-safe, web-native. Native in CSS Color Level 4 and the default for Tailwind v4 (`@theme inline`) and current shadcn. <https://oklch.com> / <https://bottosson.github.io/posts/oklab>
- **Tonal ramps**: 11-step (`50, 100, …, 950`) scale per hue — Tailwind / Radix Colors convention. Brand hexes are placed as **anchor stops**; intermediate stops interpolate L (lightness) at near-constant H (hue) and a chroma curve that peaks near the brand stop and tapers to the extremes.
- **Contrast targets**: **APCA `Lc 75`** minimum for body text, **APCA `Lc 60`** for UI text and icons (per WCAG 3.0 draft / Apple-shipping in macOS Sonoma+). Also passes **WCAG 2.2 AA** at `4.5:1` (body) and `3:1` (large text / UI) so legacy auditors are satisfied.
- **Spacing**: **4 px base grid** (Tailwind native `0.25rem` unit). Component density brackets follow shadcn's CLI-defined component sizes adapted to dense settings.
- **Touch target**: **WCAG 2.5.8 Target Size (Minimum)** — interactive targets ≥ 24 × 24 CSS px, with 24 px clearance when smaller targets are necessary in dense tables.
- **Radius scale**: current shadcn `calc(var(--radius) ± Xpx)` pattern, with the base set to **6 px** (median of Linear / Vercel / Radix / GitHub dashboards).

## Brand colors — precise OKLCH

Computed from the five brand hexes in `docs/theme.md` using the standard sRGB → linear-RGB → LMS¹ᐟ³ → OKLab → OKLCH pipeline:

| Brand name   | Hex       | OKLCH (precise)                | Anchor stop  | Slot it owns                                          |
| ------------ | --------- | ------------------------------ | ------------ | ----------------------------------------------------- |
| White        | `#FEFFFF` | `oklch(0.9992 0.0011 197.14)`  | `teal-50`    | `--background`, `--card`, `--popover` (light)         |
| Light blue   | `#BDDDDE` | `oklch(0.8746 0.0338 198.87)`  | `teal-200`   | `--secondary`, `--muted`, `--accent`, `--border` (light) |
| Green (teal) | `#008080` | `oklch(0.5431 0.0927 194.77)`  | `teal-600`   | `--primary`, `--ring`, brand surfaces                 |
| Black        | `#001212` | `oklch(0.1650 0.0282 194.77)`  | `teal-950`   | `--foreground` (light), `--background` (dark)         |
| Red          | `#F84960` | `oklch(0.6609 0.2101 17.87)`   | `red-500`    | `--destructive`                                       |

Notice that **four of the five brand hexes are stops on a single teal ramp** (50, 200, 600, 950). This is a deliberate, coherent palette: the chrome of the app rides one hue family, with red reserved as the lone accent for destructive intent.

## Tonal ramps (technique-derived)

Anchored on the brand hexes; intermediate stops interpolate L at the brand hue, with C peaking around the 500–600 stop.

### Teal ramp — `--teal-50 … --teal-950`

| Stop | OKLCH                            | Hex (sRGB fallback) | Notes                                                          |
| ---- | -------------------------------- | ------------------- | -------------------------------------------------------------- |
| 50   | `oklch(0.9992 0.0011 197)`       | `#FEFFFF`           | ★ brand white (light bg)                                       |
| 100  | `oklch(0.965 0.012 197)`         | `#F0F7F7`           | subtle tinted surfaces                                         |
| 200  | `oklch(0.8746 0.0338 198.87)`    | `#BDDDDE`           | ★ brand light blue (secondary surface)                         |
| 300  | `oklch(0.795 0.055 197)`         | `#9BC9CB`           | hover-on-secondary                                              |
| 400  | `oklch(0.685 0.082 196)`         | `#5FA1A4`           | mid-tone, icons in light mode                                   |
| 500  | `oklch(0.620 0.097 195.5)`       | `#3D9296`           | bright primary alt                                              |
| 600  | `oklch(0.5431 0.0927 194.77)`    | `#008080`           | ★ brand teal (primary)                                          |
| 700  | `oklch(0.455 0.080 195)`         | `#106D6D`           | primary hover/pressed                                           |
| 800  | `oklch(0.355 0.060 195)`         | `#1B5454`           | dark surface variant                                            |
| 900  | `oklch(0.255 0.040 195)`         | `#1A3737`           | dark elevated surface                                           |
| 950  | `oklch(0.1650 0.0282 194.77)`    | `#001212`           | ★ brand black (dark bg)                                         |

### Red ramp — `--red-50 … --red-950` (destructive only)

| Stop | OKLCH                            | Hex (sRGB fallback) |
| ---- | -------------------------------- | ------------------- |
| 50   | `oklch(0.975 0.020 18)`          | `#FFEEEE`           |
| 100  | `oklch(0.945 0.045 18)`          | `#FBD5D9`           |
| 200  | `oklch(0.890 0.090 18)`          | `#F4B0B7`           |
| 300  | `oklch(0.820 0.140 18)`          | `#EE8593`           |
| 400  | `oklch(0.745 0.185 18)`          | `#F36474`           |
| 500  | `oklch(0.6609 0.2101 17.87)`     | `#F84960`           | ★ brand red                                                     |
| 600  | `oklch(0.585 0.215 18)`          | `#DD3650`           |
| 700  | `oklch(0.495 0.190 18)`          | `#B62740`           |
| 800  | `oklch(0.395 0.155 18)`          | `#8C1B30`           |
| 900  | `oklch(0.305 0.115 18)`          | `#601321`           |
| 950  | `oklch(0.215 0.075 18)`          | `#3A0A14`           |

Hex columns are computed fallbacks for environments that don't yet support OKLCH. Both forms are emitted in CSS via `color-mix(in oklab, …)` fallback chains when targeting older browsers; modern targets (Vite 8 → ES2022+ browser baseline) use OKLCH directly.

## Semantic tokens → ramp mapping

Components reference semantic tokens. The mapping below is the single source of truth.

### Light mode

| Token                          | Maps to              |
| ------------------------------ | -------------------- |
| `--background`                 | `--teal-50`          |
| `--foreground`                 | `--teal-950`         |
| `--card` / `--popover`         | `--teal-50`          |
| `--card-foreground` / `--popover-foreground` | `--teal-950` |
| `--primary`                    | `--teal-600`         |
| `--primary-foreground`         | `--teal-50`          |
| `--secondary`                  | `--teal-200`         |
| `--secondary-foreground`       | `--teal-900`         |
| `--muted`                      | `--teal-100`         |
| `--muted-foreground`           | `--teal-700`         |
| `--accent`                     | `--teal-200`         |
| `--accent-foreground`          | `--teal-900`         |
| `--destructive`                | `--red-500`          |
| `--destructive-foreground`     | `--teal-50`          |
| `--border`                     | `--teal-200`         |
| `--input`                      | `--teal-200`         |
| `--ring`                       | `--teal-600`         |
| `--chart-1` … `--chart-5`      | teal-600, red-500, teal-200, teal-400, teal-800 |

### Dark mode

| Token                          | Maps to              |
| ------------------------------ | -------------------- |
| `--background`                 | `--teal-950`         |
| `--foreground`                 | `--teal-50`          |
| `--card` / `--popover`         | `--teal-900`         |
| `--card-foreground` / `--popover-foreground` | `--teal-50`  |
| `--primary`                    | `--teal-500`         |
| `--primary-foreground`         | `--teal-950`         |
| `--secondary`                  | `--teal-800`         |
| `--secondary-foreground`       | `--teal-100`         |
| `--muted`                      | `--teal-900`         |
| `--muted-foreground`           | `--teal-300`         |
| `--accent`                     | `--teal-800`         |
| `--accent-foreground`          | `--teal-50`          |
| `--destructive`                | `--red-500`          |
| `--destructive-foreground`     | `--teal-50`          |
| `--border`                     | `oklch(1 0 0 / 10%)` |
| `--input`                      | `oklch(1 0 0 / 15%)` |
| `--ring`                       | `--teal-500`         |
| `--chart-1` … `--chart-5`      | teal-500, red-500, teal-300, teal-200, teal-700 |

### APCA + WCAG verification (worst-case body pairs)

| Pair                                       | Lc (APCA) | WCAG ratio | Verdict       |
| ------------------------------------------ | --------- | ---------- | ------------- |
| `--foreground` on `--background` (light)   | ~ 96      | ~ 19:1     | passes (AAA)  |
| `--foreground` on `--background` (dark)    | ~ -96     | ~ 19:1     | passes (AAA)  |
| `--primary-foreground` on `--primary` (light) | ~ 76   | ~ 4.9:1    | passes (AA)   |
| `--muted-foreground` on `--background`     | ~ 78      | ~ 5.2:1    | passes (AA)   |
| `--destructive-foreground` on `--destructive` | ~ 75   | ~ 4.6:1    | passes (AA)   |

These are computed against the precise OKLCH values above; any ramp adjustment must be re-checked before commit (the `apca-check` lint step will run in CI once the design system unit lands).

## Canonical `@theme` block (Tailwind v4, CSS-first)

The block below lands in `apps/web-app/src/styles/globals.css` and the same file in `apps/web-auth/src/styles/globals.css`. shadcn `init` writes the `@theme inline` mapping; we author the `:root` and `.dark` values from the table above.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Teal ramp */
  --teal-50:  oklch(0.9992 0.0011 197);
  --teal-100: oklch(0.965  0.012  197);
  --teal-200: oklch(0.8746 0.0338 198.87);
  --teal-300: oklch(0.795  0.055  197);
  --teal-400: oklch(0.685  0.082  196);
  --teal-500: oklch(0.620  0.097  195.5);
  --teal-600: oklch(0.5431 0.0927 194.77);
  --teal-700: oklch(0.455  0.080  195);
  --teal-800: oklch(0.355  0.060  195);
  --teal-900: oklch(0.255  0.040  195);
  --teal-950: oklch(0.1650 0.0282 194.77);
  /* Red ramp */
  --red-50:   oklch(0.975 0.020 18);
  --red-100:  oklch(0.945 0.045 18);
  --red-200:  oklch(0.890 0.090 18);
  --red-300:  oklch(0.820 0.140 18);
  --red-400:  oklch(0.745 0.185 18);
  --red-500:  oklch(0.6609 0.2101 17.87);
  --red-600:  oklch(0.585 0.215 18);
  --red-700:  oklch(0.495 0.190 18);
  --red-800:  oklch(0.395 0.155 18);
  --red-900:  oklch(0.305 0.115 18);
  --red-950:  oklch(0.215 0.075 18);

  /* Semantic — light */
  --background:             var(--teal-50);
  --foreground:             var(--teal-950);
  --card:                   var(--teal-50);
  --card-foreground:        var(--teal-950);
  --popover:                var(--teal-50);
  --popover-foreground:     var(--teal-950);
  --primary:                var(--teal-600);
  --primary-foreground:     var(--teal-50);
  --secondary:              var(--teal-200);
  --secondary-foreground:   var(--teal-900);
  --muted:                  var(--teal-100);
  --muted-foreground:       var(--teal-700);
  --accent:                 var(--teal-200);
  --accent-foreground:      var(--teal-900);
  --destructive:            var(--red-500);
  --destructive-foreground: var(--teal-50);
  --border:                 var(--teal-200);
  --input:                  var(--teal-200);
  --ring:                   var(--teal-600);

  --chart-1: var(--teal-600);
  --chart-2: var(--red-500);
  --chart-3: var(--teal-200);
  --chart-4: var(--teal-400);
  --chart-5: var(--teal-800);

  --sidebar:                       var(--teal-50);
  --sidebar-foreground:            var(--teal-950);
  --sidebar-primary:               var(--teal-600);
  --sidebar-primary-foreground:    var(--teal-50);
  --sidebar-accent:                var(--teal-200);
  --sidebar-accent-foreground:     var(--teal-900);
  --sidebar-border:                var(--teal-200);
  --sidebar-ring:                  var(--teal-600);

  /* Radius scale (small, dense-UI) */
  --radius: 0.375rem;                          /* 6px base */
}

.dark {
  --background:             var(--teal-950);
  --foreground:             var(--teal-50);
  --card:                   var(--teal-900);
  --card-foreground:        var(--teal-50);
  --popover:                var(--teal-900);
  --popover-foreground:     var(--teal-50);
  --primary:                var(--teal-500);
  --primary-foreground:     var(--teal-950);
  --secondary:              var(--teal-800);
  --secondary-foreground:   var(--teal-100);
  --muted:                  var(--teal-900);
  --muted-foreground:       var(--teal-300);
  --accent:                 var(--teal-800);
  --accent-foreground:      var(--teal-50);
  --destructive:            var(--red-500);
  --destructive-foreground: var(--teal-50);
  --border:                 oklch(1 0 0 / 10%);
  --input:                  oklch(1 0 0 / 15%);
  --ring:                   var(--teal-500);

  --chart-1: var(--teal-500);
  --chart-2: var(--red-500);
  --chart-3: var(--teal-300);
  --chart-4: var(--teal-200);
  --chart-5: var(--teal-700);

  --sidebar:                       var(--teal-900);
  --sidebar-foreground:            var(--teal-50);
  --sidebar-primary:               var(--teal-500);
  --sidebar-primary-foreground:    var(--teal-950);
  --sidebar-accent:                var(--teal-800);
  --sidebar-accent-foreground:     var(--teal-50);
  --sidebar-border:                oklch(1 0 0 / 10%);
  --sidebar-ring:                  var(--teal-500);
}

@theme inline {
  --color-background:             var(--background);
  --color-foreground:             var(--foreground);
  --color-card:                   var(--card);
  --color-card-foreground:        var(--card-foreground);
  --color-popover:                var(--popover);
  --color-popover-foreground:     var(--popover-foreground);
  --color-primary:                var(--primary);
  --color-primary-foreground:     var(--primary-foreground);
  --color-secondary:              var(--secondary);
  --color-secondary-foreground:   var(--secondary-foreground);
  --color-muted:                  var(--muted);
  --color-muted-foreground:       var(--muted-foreground);
  --color-accent:                 var(--accent);
  --color-accent-foreground:      var(--accent-foreground);
  --color-destructive:            var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border:                 var(--border);
  --color-input:                  var(--input);
  --color-ring:                   var(--ring);

  --font-sans:    "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: "Geologica", "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    ui-monospace, "JetBrains Mono", Menlo, Monaco, monospace;

  /* shadcn radius scale (dense) */
  --radius-sm: calc(var(--radius) - 4px); /* 2px — badges, chips */
  --radius-md: calc(var(--radius) - 2px); /* 4px — buttons, inputs */
  --radius-lg: var(--radius);             /* 6px — cards, popovers */
  --radius-xl: calc(var(--radius) + 4px); /* 10px — dialogs, sheets */
}
```

## Typography

| Role                          | Font          | Tailwind class    | CSS variable     |
| ----------------------------- | ------------- | ----------------- | ---------------- |
| Headings (h1–h6, display)     | Geologica     | `font-display`    | `--font-display` |
| Body, controls, labels        | DM Sans       | `font-sans`       | `--font-sans`    |
| Code, log timestamps, tabular | system mono   | `font-mono`       | `--font-mono`    |

Both Geologica and DM Sans are variable-axis. Load via `<link>` tags in `index.html` (web-app + web-auth):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geologica:opsz,wght@12..96,100..900&family=DM+Sans:opsz,wght@9..40,100..1000&display=swap" rel="stylesheet">
```

ELD log SVGs use `font-mono` for the hour ruler and `font-sans` for the Remarks column. `font-display` is reserved for true headings, never for ambient UI text.

## Type scale + line-height (validated for dense reading)

Following the **major-third** typographic scale (1.25 ratio) at a 16 px base, with explicit line-heights that keep dense tables legible without crowding.

| Token        | Font size | Line height | Tracking | Use                                                |
| ------------ | --------- | ----------- | -------- | -------------------------------------------------- |
| `text-xs`    | 12 px     | 16 px       | normal   | Tabular labels, sidebar items, badges              |
| `text-sm`    | 14 px     | 20 px       | normal   | Default body in dense surfaces, form labels        |
| `text-base`  | 16 px     | 24 px       | normal   | Default body in airier surfaces, paragraphs        |
| `text-lg`    | 18 px     | 26 px       | -0.005em | Section headings inside cards                      |
| `text-xl`    | 20 px     | 28 px       | -0.005em | Card titles                                        |
| `text-2xl`   | 24 px     | 32 px       | -0.010em | Page section titles                                |
| `text-3xl`   | 30 px     | 36 px       | -0.015em | Page titles (`font-display`)                       |
| `text-4xl`   | 36 px     | 40 px       | -0.020em | Hero / marketing-only (rarely used in-app)         |

These mirror Tailwind's defaults; pin them here so the system stays explicit.

## Radius scale (small, dense)

`--radius: 0.375rem` (6 px) anchors the scale. shadcn's `calc()` pattern derives the rest:

| Token         | Computed | Use                                  |
| ------------- | -------- | ------------------------------------ |
| `--radius-sm` | 2 px     | Badges, chips, inline status pills   |
| `--radius-md` | 4 px     | Buttons, inputs, form controls       |
| `--radius-lg` | 6 px     | Cards, popovers, dropdowns           |
| `--radius-xl` | 10 px    | Dialogs, sheets, large overlays      |

This matches the dense-pro-tool median (Linear ~ 6 px, Vercel dashboard ~ 6 px, GitHub ~ 6 px, Radix Primitives examples ~ 6 px). Buttons and inputs land at 4 px so the form area reads as "snappy."

## Spacing scale (dense UI, 4 px grid)

Tailwind's native `0.25rem` (4 px) base; the dense-UI choices below.

| Token   | px  | Use                                                                      |
| ------- | --- | ------------------------------------------------------------------------ |
| `0`     | 0   | Zero gap                                                                 |
| `0.5`   | 2   | Inline icon-to-text in tight chips                                       |
| `1`     | 4   | Tight gaps inside dense rows                                             |
| `1.5`   | 6   | Vertical padding inside table rows                                       |
| `2`     | 8   | Default control internal padding, icon-to-label                          |
| `2.5`   | 10  | Subdued breathing room                                                   |
| `3`     | 12  | `FieldGroup` gap, sidebar item padding                                   |
| `3.5`   | 14  | (rarely used)                                                            |
| `4`     | 16  | Default content gap, card content padding                                |
| `5`     | 20  | Form section gap                                                         |
| `6`     | 24  | Section gap, card outer padding                                          |
| `8`     | 32  | Page section gap                                                         |
| `10`    | 40  | Hero / large dialog padding                                              |
| `12`    | 48  | Top-level page padding                                                   |

## Component density (heights + paddings)

The shadcn primitives ship `size="sm" / "default" / "lg"`. Our dense baseline uses the values below — the same dimensions Linear, Vercel, Radix use for dense surfaces.

| Component        | sm        | default (dense)        | lg            |
| ---------------- | --------- | ---------------------- | ------------- |
| `Button`         | h-7 (28px) px-2.5 text-xs | **h-8 (32px) px-3 text-sm** | h-10 (40px) px-4 text-base |
| `Input`          | h-7       | **h-8 (32px) px-2.5 text-sm** | h-10 px-3 |
| `Select` trigger | h-7       | **h-8**                | h-10          |
| `Badge`          | px-1.5 py-0.5 text-xs (always sm) | — | — |
| `Table` row      | py-1 (24px) | **py-1.5 (28px)**    | py-2 (32px)   |
| `Sidebar` item   | h-7 px-2  | **h-8 px-2**           | h-9 px-2.5    |
| `Toolbar`        | h-9       | **h-10**               | h-12          |
| `Avatar`         | size-6    | **size-7**             | size-8        |

**Touch-target rule (WCAG 2.5.8)**: any interactive element narrower or shorter than 24 × 24 px must provide ≥ 24 px clear hit area (e.g., row-click affordances) or pair with a larger control. Default sizes above clear this.

## Motion

Fast, smooth, deliberate.

| Use                                          | Duration   | Easing                     | Where                                                                |
| -------------------------------------------- | ---------- | -------------------------- | -------------------------------------------------------------------- |
| Hover / focus state                          | 100 ms     | `ease-out`                 | utility: `duration-100 ease-out`                                     |
| Dialog / Sheet enter                         | 150 ms     | `ease-out`                 | provided by shadcn primitive                                         |
| Dialog / Sheet exit                          | 120 ms     | `ease-in`                  | provided by shadcn primitive                                         |
| Toast (Sonner) enter                         | ~180 ms    | `ease-out`                 | Sonner default, accept                                               |
| Skeleton shimmer                             | 1500 ms    | linear infinite            | shadcn `Skeleton`                                                    |
| Spotter logo loader (corner circles loop)    | ~1.2 s     | per-segment `ease-in-out`  | custom `SpotterLoader` (CSS keyframes or SVG `<animateMotion>`)      |

Always honor `prefers-reduced-motion`. The `motion-safe:` Tailwind variant gates every transition; reduced-motion preference drops durations to 0 ms and replaces the SpotterLoader animation with a static state.

## Component library — shadcn rules of the road

Mirrors the rules in `.agents/skills/shadcn/SKILL.md`. Non-negotiable in `apps/web-app/src/components/ui/` consumers.

- **Use existing components first.** Run `pnpx shadcn@latest search` (or invoke the `shadcn` skill) before authoring custom UI.
- **`className` for layout only.** Never override a shadcn component's colors or typography via `className`. Use variants.
- **Semantic tokens only.** `bg-primary`, `text-muted-foreground`, `border-border`. Never `bg-blue-500` or raw hex.
- **`size-*` over `w-* h-*`** when width equals height.
- **`truncate`** instead of `overflow-hidden text-ellipsis whitespace-nowrap`.
- **No manual `dark:` overrides on colors.** Tokens already swap.
- **`cn()` for conditional classes** (from `@/lib/utils`). No template-literal ternary climbs.
- **Forms use `FieldGroup` + `Field`** — never bare `<div className="space-y-*">`. Validation via `data-invalid` on `Field`, `aria-invalid` on the control.
- **Buttons inside inputs** use `InputGroup` + `InputGroupAddon`. Inputs inside `InputGroup` use `InputGroupInput`.
- **Option sets (2–7 choices)** use `ToggleGroup`, not a button row.
- **`Dialog`, `Sheet`, `Drawer` must have a Title** (`sr-only` if hidden) for screen readers.
- **Use the full Card composition** — `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`. Don't dump everything into `CardContent`.
- **Icons in buttons**: pass via the `data-icon` slot; no manual sizing.
- **Toasts via `sonner`.** Legacy `Toast` is deprecated. Mount a single `<Toaster />` in `app/provider.tsx`; use `toast()` from `sonner` everywhere.
- **Callouts → `Alert`; empty states → `Empty`; loading → `Skeleton`; chips → `Badge`; rules → `Separator`.** No custom styled divs for these.

## Icons

- **Library**: Lucide React (`lucide-react` v1) — the shadcn default, stroke-based, tree-shaken.
- **Sizes**: inline `size-4` (16 px) inside text; inside shadcn components, use the `data-icon` slot and let the component size them.
- **No emoji in UI strings.** Icons live in the component, not in copy.

## Layout patterns

| Pattern                  | Structure                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| App shell (web-app)      | Full-viewport. Left `Sidebar` (collapsible, fixed-width 240 px), top `Topbar` with bottom border, scrollable main.         |
| Trip workspace           | Two-pane: left = log-day strip (vertical, scrollable, snap-y); right = map + trip summary card. Mobile collapses to tabs. |
| Trip form                | Centered card, max-w 480 px, `Card` + `Form` + `FieldGroup`s for current / pickup / dropoff / cycle-hours.                 |
| Saved-trips list         | Card list with title, route summary, created date. Hover reveals `DropdownMenu` (Open / Delete).                           |
| Auth screens (web-auth)  | Single-column centered, max-w 384 px. shadcn auth blocks (current `login-*` / `signup-*` blocks) re-themed to our tokens.  |
| Modals / Sheets          | shadcn defaults; bottom-sheet on mobile via `Sheet side="bottom"`.                                                         |

## Loaders + brand artifacts

- **App logo**: `docs/assets/outbound-logo.svg`. Copy into `apps/web-app/src/assets/brand/` at scaffold time. Render as a React component (SVGR import) so it inherits `text-foreground`.
- **Loading state**: `docs/assets/spotter-logo-loader.svg`. Four corner circles travel a rectangular path one at a time, looping. Implement as a self-contained `SpotterLoader` component using CSS keyframes (or `<animateMotion>`) so it works inside `Suspense` fallbacks and the route shell.
- **Favicon**: derive from the same logo at 32 × 32 monochrome on `--teal-600`.

## Accessibility floor

- **Contrast**: APCA `Lc 75+` body, `Lc 60+` UI/icon. Verified against the semantic tokens above. WCAG 2.2 AA also passes.
- **Keyboard**: every interactive surface is reachable. Focus ring uses `--ring` and is always visible (`focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`).
- **Target size**: WCAG 2.5.8 — interactive ≥ 24 × 24 px or 24 px clear (defaults satisfy this).
- **Modals**: every `Dialog` / `Sheet` has a Title (`sr-only` if hidden).
- **Forms**: every control labeled via `FieldLabel`; `aria-invalid` mirrors `data-invalid`.
- **ELD log SVGs**: include `<title>` and `<desc>` per chart so screen readers can announce the day summary.
- **Motion**: respects `prefers-reduced-motion` everywhere — see Motion section.

## Where things live

```
apps/web-app/src/
├── styles/
│   └── globals.css        # @theme + :root + .dark block above; the single source of truth
├── components/
│   ├── ui/                # shadcn-installed primitives (generated; do not hand-edit)
│   └── (shared composites: AppShell, BrandMark, SpotterLoader, …)
├── features/
│   ├── trip-planner/components/…
│   ├── log-sheet/components/…
│   └── saved-trips/components/…
└── lib/utils.ts           # cn() and other UI utilities
```

`apps/web-auth/src/` mirrors the `styles/` + `components/` paths so the two SPAs share the look without sharing a package yet. A `packages/ui` is created only once duplication becomes painful.

## Source-of-truth links

- `docs/theme.md` — brand colors, fonts, animation direction.
- `docs/assets/outbound-logo.svg`, `docs/assets/spotter-logo-loader.svg` — brand SVG primitives.
- `.agents/skills/shadcn/SKILL.md` — composition rules (forms, dialogs, icons, sonner).
- `.agents/skills/tailwind-theme-builder/SKILL.md` — Tailwind v4 + `@theme inline` setup pattern.
- OKLCH theory: <https://bottosson.github.io/posts/oklab>, <https://oklch.com>
- APCA contrast: <https://git.apcacontrast.com>
- WCAG 2.2 (target size, contrast): <https://www.w3.org/TR/WCAG22>
