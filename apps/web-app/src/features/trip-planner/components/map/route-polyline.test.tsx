import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  Polyline: (props: { positions: unknown; pathOptions: unknown }) => (
    <div
      data-testid="polyline"
      data-positions={JSON.stringify(props.positions)}
      data-options={JSON.stringify(props.pathOptions)}
    />
  ),
}));

const { RoutePolyline } = await import("@/features/trip-planner/components/map/route-polyline");

describe("RoutePolyline", () => {
  it("passes the [lat, lon] positions through to the Polyline (caller does the swap)", () => {
    render(
      <RoutePolyline
        positions={[
          [37.5407, -77.436],
          [40.7357, -74.1724],
        ]}
      />,
    );
    const node = screen.getByTestId("polyline");

    expect(JSON.parse(node.dataset.positions ?? "[]")).toEqual([
      [37.5407, -77.436],
      [40.7357, -74.1724],
    ]);
  });

  it("renders the brand teal-600 token via pathOptions.color", () => {
    render(<RoutePolyline positions={[[37.5407, -77.436]]} />);
    const node = screen.getByTestId("polyline");
    const options = JSON.parse(node.dataset.options ?? "{}") as { color: string; weight: number };

    expect(options.color).toBe("var(--teal-600)");
    expect(options.weight).toBe(4);
  });
});
