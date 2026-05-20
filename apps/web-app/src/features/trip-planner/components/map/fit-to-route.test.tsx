import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fitBounds = vi.fn();
const mockMap = {
  fitBounds,
};

vi.mock("react-leaflet", () => ({
  useMap: () => mockMap,
}));

const { FitToRoute } = await import("@/features/trip-planner/components/map/fit-to-route");

describe("FitToRoute", () => {
  afterEach(() => {
    fitBounds.mockClear();
  });

  it("fits the map once when positions go from empty to non-empty", () => {
    const { rerender: rerenderImpl } = render(<FitToRoute positions={[]} />);
    expect(fitBounds).not.toHaveBeenCalled();

    rerenderImpl(
      <FitToRoute
        positions={[
          [37.5407, -77.436],
          [40.7357, -74.1724],
        ]}
      />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(fitBounds.mock.calls[0]?.[1]).toEqual({ padding: [48, 48] });
  });

  it("does not re-fit on re-render with the same hasPositions value", () => {
    const positions = [
      [37.5407, -77.436],
      [40.7357, -74.1724],
    ] as [number, number][];
    const { rerender: rerenderImpl } = render(<FitToRoute positions={positions} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);

    // Same length, different reference — closure still reads the latest array,
    // but the dep array uses hasPositions only so no extra fit fires.
    rerenderImpl(<FitToRoute positions={[...positions]} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an empty positions array", () => {
    render(<FitToRoute positions={[]} />);
    expect(fitBounds).not.toHaveBeenCalled();
  });
});
