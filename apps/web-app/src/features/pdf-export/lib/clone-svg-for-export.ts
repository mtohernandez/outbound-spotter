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
      if (value && value !== "" && value !== "normal") {
        targetNode.setAttribute(property, value);
      }
    }
    sourceNode = sourceWalker.nextNode();
    targetNode = targetWalker.nextNode();
  }
}
