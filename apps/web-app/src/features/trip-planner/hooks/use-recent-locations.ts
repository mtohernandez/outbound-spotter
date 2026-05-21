import { useUser } from "@clerk/react";
import { useCallback, useState } from "react";

import type { GeocodeFeature } from "@/features/trip-planner/api/geocode-autocomplete";

const MAX_RECENTS = 3;
const STORAGE_KEY_PREFIX = "outbound-recent-locations:";
const ANONYMOUS_USER_ID = "anonymous";

function buildStorageKey(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${userId ?? ANONYMOUS_USER_ID}`;
}

function loadFromStorage(key: string): readonly GeocodeFeature[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate older entries that lack newer fields; keep only items that
    // satisfy the minimum schema.
    return parsed.filter((item): item is GeocodeFeature => {
      if (typeof item !== "object" || item === null) return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.label === "string" &&
        typeof record.lat === "number" &&
        typeof record.lon === "number"
      );
    });
  } catch {
    return [];
  }
}

function saveToStorage(key: string, entries: readonly GeocodeFeature[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch (error) {
    // Safari private mode raises QuotaExceededError. Swallow — recents are
    // best-effort, never a hard requirement.
    console.warn("recent-locations: failed to persist", error);
  }
}

export interface UseRecentLocationsResult {
  readonly recents: readonly GeocodeFeature[];
  readonly pushRecent: (feature: GeocodeFeature) => void;
}

interface InternalState {
  readonly storageKey: string;
  readonly recents: readonly GeocodeFeature[];
}

export function useRecentLocations(): UseRecentLocationsResult {
  const { user } = useUser();
  const userId = user?.id;
  const storageKey = buildStorageKey(userId);

  // React-docs-endorsed "derive state from props" pattern: store the key
  // along with the recents and detect a mismatch during render. setState
  // during render is allowed by React when applied to the *current*
  // component (no cascading-render rule violation, no useEffect needed).
  const [state, setState] = useState<InternalState>(() => ({
    storageKey,
    recents: loadFromStorage(storageKey),
  }));

  if (state.storageKey !== storageKey) {
    setState({ storageKey, recents: loadFromStorage(storageKey) });
  }

  const pushRecent = useCallback((feature: GeocodeFeature) => {
    setState((current) => {
      const next = [
        feature,
        ...current.recents.filter(
          (entry) => entry.lat !== feature.lat || entry.lon !== feature.lon,
        ),
      ].slice(0, MAX_RECENTS);
      saveToStorage(current.storageKey, next);
      return { storageKey: current.storageKey, recents: next };
    });
  }, []);

  return { recents: state.recents, pushRecent };
}
