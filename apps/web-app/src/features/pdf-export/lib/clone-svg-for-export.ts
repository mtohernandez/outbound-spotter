const HYDRATED_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "fill",
  "stroke",
  "stroke-width",
  "opacity",
] as const;

const COLOR_PROPERTIES: ReadonlySet<string> = new Set(["fill", "stroke"]);

// Light-mode design tokens (mirrors :root in packages/ui/src/styles/globals.css).
// Forced on the off-screen wrapper so the cloned SVG resolves against the LIGHT
// palette even when the user is in dark mode. The §395.8 paper log sheet is
// always black ink on white paper; the PDF mirrors that, independent of the UI
// theme. Without this override, dark-mode `--foreground` resolves to white and
// every line / glyph paints white-on-white in the PDF.
const LIGHT_FOREGROUND = "oklch(0.165 0.0282 194.77)";
const LIGHT_BACKGROUND = "oklch(0.9992 0.0011 197)";
const LIGHT_THEME_TOKEN_OVERRIDES: readonly (readonly [string, string])[] = [
  ["--background", LIGHT_BACKGROUND],
  ["--foreground", LIGHT_FOREGROUND],
  ["--card", LIGHT_BACKGROUND],
  ["--card-foreground", LIGHT_FOREGROUND],
  ["--muted", "oklch(0.965 0.012 197)"],
  ["--muted-foreground", "oklch(0.455 0.03 195)"],
  ["--border", "oklch(0.8746 0.0338 198.87)"],
  ["--primary", "oklch(0.5431 0.0927 194.77)"],
  ["--primary-foreground", LIGHT_BACKGROUND],
];

interface HydrationContainer {
  readonly clone: SVGSVGElement;
  /** Removes the off-screen container from the DOM. */
  readonly cleanup: () => void;
}

export function cloneSvgForExport(svgEl: SVGSVGElement): HydrationContainer {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  const offscreen = document.createElement("div");
  offscreen.style.position = "fixed";
  offscreen.style.left = "-9999px";
  offscreen.style.top = "-9999px";
  offscreen.style.visibility = "hidden";
  offscreen.style.pointerEvents = "none";
  offscreen.setAttribute("aria-hidden", "true");
  for (const [token, value] of LIGHT_THEME_TOKEN_OVERRIDES) {
    offscreen.style.setProperty(token, value);
  }
  // currentColor falls back to the `color` property when the cascade doesn't
  // route a `--color-foreground` lookup all the way through; setting it
  // explicitly here is belt-and-suspenders.
  offscreen.style.color = LIGHT_FOREGROUND;
  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  hydrateComputedStyles(clone);

  return {
    clone,
    cleanup: () => {
      offscreen.remove();
    },
  };
}

// Reads computed styles from the (already-cloned) element so the wrapper's
// LIGHT_THEME_TOKEN_OVERRIDES take effect; stamps the resolved values as SVG
// attributes so svg2pdf — which paints attributes, not CSS — emits ink the
// PDF reader can render.
function hydrateComputedStyles(element: Element): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node instanceof Element) {
    const computed = window.getComputedStyle(node);
    for (const property of HYDRATED_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (!value || value === "" || value === "normal") continue;
      const writeValue = COLOR_PROPERTIES.has(property) ? toSrgbColor(value) : value;
      node.setAttribute(property, writeValue);
    }
    node = walker.nextNode();
  }
}

// svg2pdf.js delegates color parsing to a library that does not understand the
// CSS Color Level 4 oklch()/oklab()/color() functions our theme is built on
// (see context/ui-context.md). Without this normalization step, every fill /
// stroke resolved through `currentColor` lands in the exported PDF as no paint
// at all, producing the blank-sheet regression hotfixed here.
//
// We force normalization by painting a 1x1 pixel and reading back the device
// bytes via getImageData. `ctx.fillStyle = input; ctx.fillStyle` alone is NOT
// enough on modern Chromium (111+) / Safari (16.4+) / Firefox (113+): the CSS
// Color spec now lets the implementation preserve the original colour function
// across the setter/getter round-trip, so `fillStyle = "oklch(...)"` returns
// the oklch string verbatim (verified in DevTools against Chrome 137 on
// 2026-05-21). fillRect → getImageData forces a rasterization step that always
// emits sRGB bytes, which we encode back to `#rrggbb` (or `rgba(...)` when
// translucent) — svg2pdf paints both.
let _colorCtx: CanvasRenderingContext2D | null | undefined;
function toSrgbColor(input: string): string {
  if (input === "none" || input === "currentColor" || input === "transparent") return input;
  if (_colorCtx === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    _colorCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (_colorCtx === null) return input;
  _colorCtx.clearRect(0, 0, 1, 1);
  // Reset to a known value so an unparseable input falls back to black instead
  // of inheriting whatever the previous round-trip happened to leave behind.
  _colorCtx.fillStyle = "#000";
  _colorCtx.fillStyle = input;
  _colorCtx.fillRect(0, 0, 1, 1);
  const data = _colorCtx.getImageData(0, 0, 1, 1).data;
  // Uint8ClampedArray of length 4; the spec guarantees [r, g, b, a].
  const r = data[0] ?? 0;
  const g = data[1] ?? 0;
  const b = data[2] ?? 0;
  const a = data[3] ?? 0;
  if (a === 255) {
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}
