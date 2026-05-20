import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import type { TripResponse } from "@/features/trip-planner/schemas/trip-response";

const fitBounds = vi.fn();
const mockMap = {
  fitBounds,
  // getContainer() resolves at call time so it returns the live <div> the
  // MapContainer mock just rendered — the only element that can hold focus.
  getContainer: (): HTMLElement => {
    const el = document.querySelector('[data-testid="map-container"]');
    if (!(el instanceof HTMLElement)) {
      throw new Error("map-container not rendered yet");
    }
    return el;
  },
};

vi.mock("react-leaflet", () => ({
  MapContainer: ({
    children,
    ref,
    "aria-label": ariaLabel,
    className,
  }: {
    children?: React.ReactNode;
    ref?: { current: unknown } | ((map: unknown) => void);
    "aria-label"?: string;
    className?: string;
  }) => {
    if (typeof ref === "function") {
      ref(mockMap);
    } else if (ref) {
      ref.current = mockMap;
    }
    return (
      // Leaflet's keyboard handler auto-assigns tabindex="0" + role on the
      // underlying div at runtime; the mock mirrors that so focus tests work
      // in jsdom. eslint-disable: the role exists at runtime, not here.
      <div
        data-testid="map-container"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </div>
    );
  },
  TileLayer: (props: { url: string }) => <div data-testid="tile-layer" data-url={props.url} />,
  Marker: ({
    position,
    keyboard,
    children,
  }: {
    position: [number, number];
    keyboard?: boolean;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid="marker"
      data-lat={String(position[0])}
      data-lon={String(position[1])}
      data-keyboard={String(keyboard ?? false)}
    >
      {children}
    </div>
  ),
  Popup: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
    <div data-testid="popup" className={className}>
      {children}
    </div>
  ),
  Polyline: (props: { positions: unknown }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(props.positions)} />
  ),
  useMap: () => mockMap,
}));

const { default: TripMap } = await import("@/features/trip-planner/components/trip-map");

const TRIP: TripResponse = {
  id: "trip-1",
  created_at: "2026-05-20T00:00:00Z",
  start_at: "2026-05-21T14:00:00-04:00",
  current_label: "Richmond, VA",
  current_lat: 37.5407,
  current_lon: -77.436,
  pickup_label: "Fredericksburg, VA",
  pickup_lat: 38.3032,
  pickup_lon: -77.4605,
  dropoff_label: "Newark, NJ",
  dropoff_lat: 40.7357,
  dropoff_lon: -74.1724,
  cycle_hours_used: "35.0",
  route_polyline: [
    [-77.436, 37.5407],
    [-77.4605, 38.3032],
    [-74.1724, 40.7357],
  ],
  route_segments: [
    { distance_mi: 67.4, duration_s: 4321, from_index: 0, to_index: 1 },
    { distance_mi: 275.3, duration_s: 14760, from_index: 1, to_index: 2 },
  ],
  route_summary: { distance_mi: 342.7, duration_s: 19080 },
};

const PLAN: TripPlan = {
  trip_id: "trip-1",
  start_at: "2026-05-21T14:00:00-04:00",
  home_terminal_tz: "America/New_York",
  stops: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      kind: "pickup",
      sequence: 0,
      polyline_index: 1,
      lat: 38.3032,
      lon: -77.4605,
      label: "Fredericksburg, VA",
      scheduled_at: "2026-05-21T15:30:00-04:00",
      duration_s: 3600,
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      kind: "dropoff",
      sequence: 1,
      polyline_index: 2,
      lat: 40.7357,
      lon: -74.1724,
      label: "Newark, NJ",
      scheduled_at: "2026-05-21T21:30:00-04:00",
      duration_s: 3600,
    },
  ],
  events: [],
  days: [],
};

afterEach(() => {
  fitBounds.mockClear();
});

describe("TripMap", () => {
  it("renders one marker per stop with keyboard enabled", () => {
    render(<TripMap trip={TRIP} plan={PLAN} />);
    const markers = screen.getAllByTestId("marker");

    expect(markers).toHaveLength(2);
    for (const marker of markers) {
      expect(marker.dataset.keyboard).toBe("true");
    }
  });

  it("renders the OSM tile layer + polyline + accessible aria-label", () => {
    render(<TripMap trip={TRIP} plan={PLAN} />);

    expect(screen.getByTestId("tile-layer").dataset.url).toBe(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
    expect(screen.getByTestId("polyline")).toBeInTheDocument();
    expect(screen.getByLabelText(/trip route map/i)).toBeInTheDocument();
  });

  it("clicking the Recenter button calls fitBounds with the route polyline", async () => {
    const user = userEvent.setup();
    render(<TripMap trip={TRIP} plan={PLAN} />);
    // Clear the initial-mount fit from <FitToRoute /> so this assertion is
    // about the explicit recenter affordance only.
    fitBounds.mockClear();

    await user.click(screen.getByRole("button", { name: /recenter route/i }));

    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(fitBounds.mock.calls[0]?.[0]).toEqual([
      [37.5407, -77.436],
      [38.3032, -77.4605],
      [40.7357, -74.1724],
    ]);
    expect(fitBounds.mock.calls[0]?.[1]).toEqual({ padding: [48, 48] });
  });

  it("pressing R recenters ONLY when the map container has focus", () => {
    render(<TripMap trip={TRIP} plan={PLAN} />);
    fitBounds.mockClear();

    // Without focus on the map container → no-op.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    expect(fitBounds).not.toHaveBeenCalled();

    // Now give the map container focus and press R again.
    screen.getByTestId("map-container").focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("ignores Cmd/Ctrl+R so the browser reload still works", () => {
    render(<TripMap trip={TRIP} plan={PLAN} />);
    screen.getByTestId("map-container").focus();
    fitBounds.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", metaKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", ctrlKey: true }));

    expect(fitBounds).not.toHaveBeenCalled();
  });
});
