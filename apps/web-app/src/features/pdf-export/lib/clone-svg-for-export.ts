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
  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  hydrateComputedStyles(svgEl, clone);

  return {
    clone,
    cleanup: () => {
      offscreen.remove();
    },
  };
}

function hydrateComputedStyles(source: Element, target: Element): void {
  const sourceWalker = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT);
  const targetWalker = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);

  let sourceNode: Node | null = sourceWalker.currentNode;
  let targetNode: Node | null = targetWalker.currentNode;

  while (sourceNode instanceof Element && targetNode instanceof Element) {
    const computed = window.getComputedStyle(sourceNode);
    for (const property of HYDRATED_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (!value || value === "" || value === "normal") continue;
      const writeValue = COLOR_PROPERTIES.has(property) ? toSrgbColor(value) : value;
      targetNode.setAttribute(property, writeValue);
    }
    sourceNode = sourceWalker.nextNode();
    targetNode = targetWalker.nextNode();
  }
}

// svg2pdf.js delegates color parsing to a library that does not understand the
// CSS Color Level 4 oklch()/oklab()/color() functions our theme is built on
// (see context/ui-context.md). Without this normalization step, every fill /
// stroke resolved through `currentColor` lands in the exported PDF as no paint
// at all, producing the blank-sheet regression hotfixed here.
let _colorCtx: CanvasRenderingContext2D | null | undefined;
function toSrgbColor(input: string): string {
  if (input === "none" || input === "currentColor" || input === "transparent") return input;
  if (_colorCtx === undefined) {
    _colorCtx = document.createElement("canvas").getContext("2d");
  }
  if (_colorCtx === null) return input;
  // Reset to a known value so an unparseable input falls back to black instead
  // of inheriting whatever the previous round-trip happened to leave behind.
  _colorCtx.fillStyle = "#000";
  _colorCtx.fillStyle = input;
  return _colorCtx.fillStyle;
}
