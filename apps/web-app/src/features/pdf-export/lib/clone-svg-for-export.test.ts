import { afterEach, describe, expect, it } from "vitest";

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
