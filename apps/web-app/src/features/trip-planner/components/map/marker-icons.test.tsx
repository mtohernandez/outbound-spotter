import globalsCss from "@outbound/ui/styles/globals.css?raw";
import { describe, expect, it } from "vitest";

import { buildMarkerIcon } from "@/features/trip-planner/components/map/marker-icons";
import {
  STOP_TYPE_CLASSNAMES,
  STOP_TYPE_TOKENS,
} from "@/features/trip-planner/components/map/stop-type-colors";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

// Loaded via Vite's `?raw` import — returns the stylesheet text verbatim,
// works under Vitest because the same Vite transform pipeline runs.

const KINDS: StopKind[] = ["pickup", "dropoff", "fuel", "break", "sleeper", "restart"];

describe("buildMarkerIcon", () => {
  it.each(KINDS)("emits CSP-safe HTML carrying the per-kind class for %s", (kind) => {
    const icon = buildMarkerIcon(kind);
    const html = (icon.options.html as string | undefined) ?? "";

    expect(html).toContain(`trip-marker__icon ${STOP_TYPE_CLASSNAMES[kind]}`);
    // No inline style attribute (CSP-compatibility — architect-review m4).
    expect(html).not.toMatch(/style="[^"]*color/);
    // No hex literals (invariant #7 — theme tokens only).
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(html).toContain('aria-hidden="true"');
  });

  it("sets a square iconSize and bottom-centered anchor", () => {
    const icon = buildMarkerIcon("pickup");

    expect(icon.options.iconSize).toEqual([28, 28]);
    expect(icon.options.iconAnchor).toEqual([14, 28]);
  });

  it("uses the className 'trip-marker' to suppress Leaflet's default chrome", () => {
    const icon = buildMarkerIcon("break");

    expect(icon.options.className).toBe("trip-marker");
  });
});

// Drift detection: each per-kind CSS rule in packages/ui/src/styles/globals.css
// must reference the token documented in STOP_TYPE_TOKENS. jsdom does not
// resolve CSS custom properties, so we parse the stylesheet text directly
// (architect-review M2 — do NOT use getComputedStyle here).
describe("stop-type CSS rule drift", () => {
  it.each(KINDS)("CSS rule for %s references the documented token", (kind) => {
    const className = STOP_TYPE_CLASSNAMES[kind];
    const token = STOP_TYPE_TOKENS[kind];
    const ruleRegex = new RegExp(`\\.${className}\\s*\\{[^}]*color:\\s*var\\(${token}\\)`);

    expect(globalsCss).toMatch(ruleRegex);
  });
});
