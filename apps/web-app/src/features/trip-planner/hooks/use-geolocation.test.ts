import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGeolocation } from "@/features/trip-planner/hooks/use-geolocation";

interface PositionErrorLike {
  readonly code: number;
  readonly PERMISSION_DENIED: number;
  readonly POSITION_UNAVAILABLE: number;
  readonly TIMEOUT: number;
  readonly message: string;
}

function makeError(code: number, message: string): PositionErrorLike {
  return {
    code,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
    message,
  };
}

describe("useGeolocation", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      writable: true,
      value: {
        getCurrentPosition: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with the coordinates and sets status to success on a US position", async () => {
    const getCurrentPosition = vi.fn(
      (success: (p: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 37.5407, longitude: -77.436 } });
      },
    );
    navigator.geolocation.getCurrentPosition = getCurrentPosition;

    const { result } = renderHook(() => useGeolocation());

    const coords = await result.current.request();

    expect(coords).toEqual({ lat: 37.5407, lon: -77.436 });
    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
  });

  it("flags outside-US for a London position", async () => {
    navigator.geolocation.getCurrentPosition = vi.fn(
      (success: (p: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
      },
    );

    const { result } = renderHook(() => useGeolocation());

    const coords = await result.current.request();

    expect(coords).toBeNull();
    await waitFor(() => {
      expect(result.current.status).toBe("outside-us");
    });
    expect(result.current.error?.message).toMatch(/outside the us/i);
  });

  it("maps PERMISSION_DENIED to status 'denied'", async () => {
    navigator.geolocation.getCurrentPosition = vi.fn(
      (_success: unknown, failure: (e: PositionErrorLike) => void) => {
        failure(makeError(1, "permission denied"));
      },
    );

    const { result } = renderHook(() => useGeolocation());
    const coords = await result.current.request();

    expect(coords).toBeNull();
    await waitFor(() => {
      expect(result.current.status).toBe("denied");
    });
  });

  it("maps TIMEOUT to status 'timeout'", async () => {
    navigator.geolocation.getCurrentPosition = vi.fn(
      (_success: unknown, failure: (e: PositionErrorLike) => void) => {
        failure(makeError(3, "timed out"));
      },
    );

    const { result } = renderHook(() => useGeolocation());
    await result.current.request();

    await waitFor(() => {
      expect(result.current.status).toBe("timeout");
    });
  });

  it("maps POSITION_UNAVAILABLE to status 'unavailable'", async () => {
    navigator.geolocation.getCurrentPosition = vi.fn(
      (_success: unknown, failure: (e: PositionErrorLike) => void) => {
        failure(makeError(2, "unavailable"));
      },
    );

    const { result } = renderHook(() => useGeolocation());
    await result.current.request();

    await waitFor(() => {
      expect(result.current.status).toBe("unavailable");
    });
  });
});
