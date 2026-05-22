import { afterEach, describe, expect, it, vi } from "vitest";

import { cloneSvgForExport } from "@/features/pdf-export/lib/clone-svg-for-export";

const SVG_NS = "http://www.w3.org/2000/svg";

function buildSourceSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  // Inline styles drive getComputedStyle's resolution under jsdom; matches the
  // path the spec-08 SVG takes through the @theme block at runtime.
  svg.style.color = "rgb(20, 30, 40)";

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", "10");
  text.setAttribute("y", "20");
  text.style.fontFamily = "DM Sans, sans-serif";
  text.style.fontSize = "12px";
  text.style.fill = "currentColor";
  text.textContent = "Driver";
  svg.appendChild(text);

  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", "0");
  line.setAttribute("y1", "50");
  line.setAttribute("x2", "100");
  line.setAttribute("y2", "50");
  line.style.stroke = "currentColor";
  line.style.strokeWidth = "1.2";
  svg.appendChild(line);

  document.body.appendChild(svg);
  return svg;
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length > 0) {
    const next = cleanups.pop();
    next?.();
  }
  document.body.innerHTML = "";
});

describe("cloneSvgForExport", () => {
  it("returns a structural copy of the source svg", () => {
    const source = buildSourceSvg();

    const { clone, cleanup } = cloneSvgForExport(source);
    cleanups.push(cleanup);

    expect(clone).not.toBe(source);
    expect(clone.tagName).toBe("svg");
    expect(clone.querySelectorAll("text")).toHaveLength(1);
    expect(clone.querySelectorAll("line")).toHaveLength(1);
  });

  it("hydrates font + fill + stroke + stroke-width attributes from getComputedStyle", () => {
    const source = buildSourceSvg();

    const { clone, cleanup } = cloneSvgForExport(source);
    cleanups.push(cleanup);

    const text = clone.querySelector("text");
    const line = clone.querySelector("line");
    expect(text?.getAttribute("font-family")).toContain("DM Sans");
    expect(text?.getAttribute("font-size")).toBe("12px");
    expect(text?.getAttribute("fill")).toBeTruthy();
    expect(line?.getAttribute("stroke")).toBeTruthy();
    expect(line?.getAttribute("stroke-width")).toBe("1.2");
  });

  it("attaches the clone to the document so getComputedStyle can resolve", () => {
    const source = buildSourceSvg();

    const { clone, cleanup } = cloneSvgForExport(source);
    cleanups.push(cleanup);

    expect(clone.isConnected).toBe(true);
    // Wrapper container hides the clone off-screen.
    const wrapper = clone.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.style.position).toBe("fixed");
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  it("forces light-mode design tokens on the off-screen wrapper so dark-mode users still export legible PDFs", () => {
    // The §395.8 paper log sheet is always black ink on white paper. The PDF
    // mirrors that regardless of the user's UI theme — so the wrapper sets
    // --foreground / --background / --muted-foreground / --border (and
    // explicit `color`) to the light palette before hydration runs. Without
    // this, dark-mode --foreground resolves to white and every ink stroke
    // paints white-on-white in the PDF (the post-launch regression hotfixed
    // alongside the oklch normalization).
    const source = buildSourceSvg();
    const { clone, cleanup } = cloneSvgForExport(source);
    cleanups.push(cleanup);

    const wrapper = clone.parentElement;
    expect(wrapper?.style.getPropertyValue("--foreground")).toBe("oklch(0.165 0.0282 194.77)");
    expect(wrapper?.style.getPropertyValue("--background")).toBe("oklch(0.9992 0.0011 197)");
    expect(wrapper?.style.getPropertyValue("--muted-foreground")).toBe("oklch(0.455 0.03 195)");
    expect(wrapper?.style.getPropertyValue("--border")).toBe("oklch(0.8746 0.0338 198.87)");
    expect(wrapper?.style.color).toBe("oklch(0.165 0.0282 194.77)");
  });

  it("cleanup() removes the off-screen wrapper from the DOM", () => {
    const source = buildSourceSvg();

    const { clone, cleanup } = cloneSvgForExport(source);
    const wrapper = clone.parentElement;
    cleanup();

    expect(wrapper?.isConnected).toBe(false);
    expect(clone.isConnected).toBe(false);
  });
});

describe("cloneSvgForExport — oklch → sRGB normalization", () => {
  // Shared canvas-context stub. The hotfix paints input into a 1x1 canvas and
  // reads back via getImageData — the setter readback alone is insufficient on
  // modern Chrome (111+), which preserves `oklch(...)` across the round-trip.
  // The stub takes a getImageData mock so each test can dictate the bytes.
  function buildFakeCtx(getImageData: () => { data: Uint8ClampedArray }): {
    seen: string[];
    fakeCtx: object;
    clearRect: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    getImageData: ReturnType<typeof vi.fn>;
  } {
    const seen: string[] = [];
    const getImageDataSpy = vi.fn(getImageData);
    const clearRect = vi.fn();
    const fillRect = vi.fn();
    const fakeCtx = {
      canvas: { width: 1, height: 1 },
      _fillStyle: "#000000",
      get fillStyle(): string {
        return this._fillStyle;
      },
      set fillStyle(value: string) {
        seen.push(value);
        this._fillStyle = value;
      },
      clearRect,
      fillRect,
      getImageData: getImageDataSpy,
    };
    return { seen, fakeCtx, clearRect, fillRect, getImageData: getImageDataSpy };
  }

  it("rewrites oklch() fills to a canvas-rasterized sRGB hex svg2pdf can paint", async () => {
    // svg2pdf.js cannot paint oklch(). We force normalization by painting the
    // colour into a 1x1 canvas and reading back the rgba bytes via
    // getImageData — `fillStyle` round-trip is no longer enough since CSS
    // Color Level 4 lets browsers preserve the original colour space.
    // The stub returns brand-teal-600 (#008080) so the assertion is exact.
    const { seen, fakeCtx, fillRect, getImageData } = buildFakeCtx(() => ({
      data: new Uint8ClampedArray([0x00, 0x80, 0x80, 0xff]),
    }));
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
    vi.resetModules();
    const { cloneSvgForExport: freshClone } =
      await import("@/features/pdf-export/lib/clone-svg-for-export");

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    svg.style.color = "oklch(0.5431 0.0927 194.77)";
    const line = document.createElementNS(SVG_NS, "line");
    line.style.stroke = "oklch(0.5431 0.0927 194.77)";
    line.style.fill = "oklch(0.5431 0.0927 194.77)";
    svg.appendChild(line);
    document.body.appendChild(svg);

    const { clone, cleanup } = freshClone(svg);
    cleanups.push(cleanup);

    const clonedLine = clone.querySelector("line");
    expect(clonedLine?.getAttribute("stroke")).toBe("#008080");
    expect(clonedLine?.getAttribute("fill")).toBe("#008080");
    expect(seen).toEqual(expect.arrayContaining([expect.stringContaining("oklch")]));
    expect(fillRect).toHaveBeenCalled();
    expect(getImageData).toHaveBeenCalled();

    getContextSpy.mockRestore();
  });

  it("emits rgba(...) when the rasterized pixel is translucent", async () => {
    // 50% alpha forces the rgba(...) branch. svg2pdf paints both formats.
    const { fakeCtx } = buildFakeCtx(() => ({
      data: new Uint8ClampedArray([0xf8, 0x49, 0x60, 0x80]),
    }));
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
    vi.resetModules();
    const { cloneSvgForExport: freshClone } =
      await import("@/features/pdf-export/lib/clone-svg-for-export");

    const svg = document.createElementNS(SVG_NS, "svg");
    const line = document.createElementNS(SVG_NS, "line");
    line.style.stroke = "color-mix(in oklab, oklch(0.66 0.21 17.87) 50%, transparent)";
    svg.appendChild(line);
    document.body.appendChild(svg);

    const { clone, cleanup } = freshClone(svg);
    cleanups.push(cleanup);

    expect(clone.querySelector("line")?.getAttribute("stroke")).toBe("rgba(248, 73, 96, 0.502)");

    getContextSpy.mockRestore();
  });

  it("does not send 'none', 'transparent', or 'currentColor' through the canvas parser", async () => {
    // currentColor must not collapse to black; 'none' must not become opaque
    // black; 'transparent' must stay transparent. The helper's early-return
    // guard is the load-bearing line — we record every value the canvas was
    // asked to parse and assert none of the passthrough sentinels appear.
    const { seen, fakeCtx } = buildFakeCtx(() => ({
      data: new Uint8ClampedArray([0, 0, 0, 255]),
    }));
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
    vi.resetModules();
    const { cloneSvgForExport: freshClone } =
      await import("@/features/pdf-export/lib/clone-svg-for-export");

    const svg = document.createElementNS(SVG_NS, "svg");
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.style.fill = "none";
    rect.style.stroke = "currentColor";
    svg.appendChild(rect);
    const rect2 = document.createElementNS(SVG_NS, "rect");
    rect2.style.fill = "transparent";
    svg.appendChild(rect2);
    document.body.appendChild(svg);

    const { cleanup } = freshClone(svg);
    cleanups.push(cleanup);

    expect(seen).not.toContain("none");
    expect(seen).not.toContain("transparent");
    expect(seen).not.toContain("currentColor");

    getContextSpy.mockRestore();
  });
});
