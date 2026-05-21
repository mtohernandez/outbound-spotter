import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeocodeFeature } from "@/features/trip-planner/api/geocode-autocomplete";
import {
  __resetRecentLocationsCacheForTests,
  useRecentLocations,
} from "@/features/trip-planner/hooks/use-recent-locations";

const userMock = vi.hoisted(() => ({ current: { id: "user-1" } }));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: userMock.current, isLoaded: true }),
}));

function feature(label: string, lat: number, lon: number): GeocodeFeature {
  return {
    label,
    country_a: "USA",
    region_a: null,
    locality: null,
    confidence: 1,
    match_type: null,
    lat,
    lon,
  };
}

function clearOutboundRecents(): void {
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("outbound-recent-locations:") === true) {
      window.localStorage.removeItem(key);
    }
  }
}

describe("useRecentLocations", () => {
  beforeEach(() => {
    clearOutboundRecents();
    __resetRecentLocationsCacheForTests();
    userMock.current = { id: "user-1" };
  });

  afterEach(() => {
    clearOutboundRecents();
    __resetRecentLocationsCacheForTests();
  });

  it("starts empty when localStorage is empty", () => {
    const { result } = renderHook(() => useRecentLocations());

    expect(result.current.recents).toEqual([]);
  });

  it("pushes recents to position 0 and caps at 3 entries", () => {
    const { result } = renderHook(() => useRecentLocations());

    act(() => {
      result.current.pushRecent(feature("A", 1, 1));
    });
    act(() => {
      result.current.pushRecent(feature("B", 2, 2));
    });
    act(() => {
      result.current.pushRecent(feature("C", 3, 3));
    });
    act(() => {
      result.current.pushRecent(feature("D", 4, 4));
    });

    expect(result.current.recents.map((r) => r.label)).toEqual(["D", "C", "B"]);
  });

  it("dedupes by (lat, lon) when re-pushing the same place", () => {
    const { result } = renderHook(() => useRecentLocations());

    act(() => {
      result.current.pushRecent(feature("A", 1, 1));
    });
    act(() => {
      result.current.pushRecent(feature("B", 2, 2));
    });
    act(() => {
      result.current.pushRecent(feature("A again", 1, 1));
    });

    expect(result.current.recents).toHaveLength(2);
    expect(result.current.recents[0]?.label).toBe("A again");
  });

  it("shares the recents store across sibling hook instances (no last-write-wins)", () => {
    // Browser-walk finding 2026-05-21: before this guard, each AddressField
    // had its own local copy of `recents` and pushRecent only persisted the
    // last sibling's pick to localStorage.
    const { result: a } = renderHook(() => useRecentLocations());
    const { result: b } = renderHook(() => useRecentLocations());

    act(() => {
      a.current.pushRecent(feature("A", 10, 10));
    });
    expect(b.current.recents.map((r) => r.label)).toEqual(["A"]);

    act(() => {
      b.current.pushRecent(feature("B", 20, 20));
    });
    expect(a.current.recents.map((r) => r.label)).toEqual(["B", "A"]);
  });

  it("namespaces recents per Clerk user id", () => {
    const { result, rerender } = renderHook(() => useRecentLocations());

    act(() => {
      result.current.pushRecent(feature("user-1 place", 10, 10));
    });

    userMock.current = { id: "user-2" };
    rerender();

    expect(result.current.recents).toEqual([]);

    act(() => {
      result.current.pushRecent(feature("user-2 place", 20, 20));
    });

    userMock.current = { id: "user-1" };
    rerender();

    expect(result.current.recents.map((r) => r.label)).toEqual(["user-1 place"]);
  });
});
