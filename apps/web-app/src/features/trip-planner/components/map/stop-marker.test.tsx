import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TripStop } from "@/features/trip-planner/schemas/trip-plan";

vi.mock("react-leaflet", () => ({
  Marker: (props: {
    position: [number, number];
    icon: unknown;
    keyboard?: boolean;
    children?: React.ReactNode;
    eventHandlers?: { mouseover?: () => void; mouseout?: () => void };
  }) => (
    <div
      data-testid="marker"
      data-lat={String(props.position[0])}
      data-lon={String(props.position[1])}
      data-keyboard={String(props.keyboard ?? false)}
      onMouseOver={props.eventHandlers?.mouseover}
      onMouseOut={props.eventHandlers?.mouseout}
      onFocus={props.eventHandlers?.mouseover}
      onBlur={props.eventHandlers?.mouseout}
    >
      {props.children}
    </div>
  ),
  Popup: (props: { className?: string; children?: React.ReactNode }) => (
    <div data-testid="popup" data-classname={props.className}>
      {props.children}
    </div>
  ),
}));

const { StopMarker } = await import("@/features/trip-planner/components/map/stop-marker");

const STOP: TripStop = {
  id: "00000000-0000-4000-8000-000000000101",
  kind: "break",
  sequence: 0,
  polyline_index: 0,
  lat: 38.3032,
  lon: -77.4605,
  label: "Rest area, I-95 N",
  scheduled_at: "2026-05-21T18:00:00-04:00",
  duration_s: 1800,
};

describe("StopMarker", () => {
  it("renders at the stop's [lat, lon]", () => {
    render(<StopMarker stop={STOP} tz="America/New_York" isHovered={false} />);
    const marker = screen.getByTestId("marker");

    expect(marker.dataset.lat).toBe("38.3032");
    expect(marker.dataset.lon).toBe("-77.4605");
  });

  it("explicitly enables keyboard reachability", () => {
    render(<StopMarker stop={STOP} tz="America/New_York" isHovered={false} />);

    expect(screen.getByTestId("marker").dataset.keyboard).toBe("true");
  });

  it("themes the popup via the leaflet-popup-themed class", () => {
    render(<StopMarker stop={STOP} tz="America/New_York" isHovered={false} />);

    expect(screen.getByTestId("popup").dataset.classname).toBe("leaflet-popup-themed");
  });

  it("renders the kind label + §395 reason for planner-inserted stops", () => {
    render(<StopMarker stop={STOP} tz="America/New_York" isHovered={false} />);

    expect(screen.getByText("30-min break")).toBeInTheDocument();
    expect(screen.getByText(/§395\.3\(a\)\(3\)\(ii\)/)).toBeInTheDocument();
  });

  it("renders the location label + duration in the popup body", () => {
    render(<StopMarker stop={STOP} tz="America/New_York" isHovered={false} />);

    expect(screen.getByText("Rest area, I-95 N")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
  });

  it("falls back to lat/lon when the label is empty", () => {
    render(<StopMarker stop={{ ...STOP, label: "" }} tz="America/New_York" isHovered={false} />);

    expect(screen.getByText("38.3032, -77.4605")).toBeInTheDocument();
  });

  it("omits the reason row for driver-input stops (no §395 citation)", () => {
    render(
      <StopMarker
        stop={{ ...STOP, kind: "pickup", label: "Fredericksburg, VA" }}
        tz="America/New_York"
        isHovered={false}
      />,
    );

    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.queryByText(/§395/)).toBeNull();
  });

  it("formats the scheduled time in the home-terminal timezone", () => {
    render(<StopMarker stop={STOP} tz="America/New_York" isHovered={false} />);

    // 2026-05-21 18:00 EDT, formatted en-US short. Node's Intl uses U+202F
    // (narrow no-break space) before AM/PM, so the matcher stays lax.
    expect(screen.getByText(/6:00.*PM/i)).toBeInTheDocument();
    expect(screen.getByText(/May 21/)).toBeInTheDocument();
  });
});
