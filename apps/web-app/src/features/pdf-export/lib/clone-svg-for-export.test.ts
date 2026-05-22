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
  it("rewrites oklch() fills to a canvas-normalized sRGB value svg2pdf can paint", async () => {
    // svg2pdf.js cannot parse oklch(); the runtime hands every color through a
    // CanvasRenderingContext2D.fillStyle round-trip, which the browser uses to
    // normalize CSS colors to #rrggbb / rgba(). jsdom ships no canvas color
    // parser, so we stub the same getContext entry point the helper caches.
    const seen: string[] = [];
    const fakeCtx = {
      _fillStyle: "#000000",
      get fillStyle(): string {
        return this._fillStyle;
      },
      set fillStyle(value: string) {
        seen.push(value);
        // Mirror real browser behavior: any well-formed input is collapsed to
        // an opaque #rrggbb. Our stub uses a fixed sentinel so the assertion
        // is deterministic across machines.
        this._fillStyle = value === "#000" ? "#000000" : "#3d9296";
      },
    };
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      // The runtime cast is `as string`; the real signature is overloaded,
      // so we widen to unknown for the spy return value.
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
    expect(clonedLine?.getAttribute("stroke")).toBe("#3d9296");
    expect(clonedLine?.getAttribute("fill")).toBe("#3d9296");
    expect(seen).toEqual(expect.arrayContaining([expect.stringContaining("oklch")]));

    getContextSpy.mockRestore();
  });

  it("does not send 'none', 'transparent', or 'currentColor' through the canvas parser", async () => {
    // currentColor must not collapse to black; 'none' must not become opaque
    // black; 'transparent' must stay transparent. The helper's early-return
    // guard is the load-bearing line — we record every value the canvas was
    // asked to parse and assert none of the passthrough sentinels appear.
    const seen: string[] = [];
    const fakeCtx = {
      _fillStyle: "#000000",
      get fillStyle(): string {
        return this._fillStyle;
      },
      set fillStyle(value: string) {
        seen.push(value);
        this._fillStyle = value;
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeCtx as unknown as CanvasRenderingContext2D,
    );
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
  });
});
