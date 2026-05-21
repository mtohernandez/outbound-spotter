import { useUser } from "@clerk/react";
import { useCallback, useSyncExternalStore } from "react";

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

// Module-level cache so every AddressField that calls useRecentLocations
// shares the same recents list and sees pushes from siblings in real time.
// Before this, each AddressField initialized its own state copy from
// localStorage on mount and overwrote sibling writes on push (last write
// won), so picking three addresses in the trip form left only the LAST in
// storage. Browser-walk finding 2026-05-21.
type Listener = () => void;
const subscribersByKey = new Map<string, Set<Listener>>();
const cacheByKey = new Map<string, readonly GeocodeFeature[]>();

function readSnapshot(key: string): readonly GeocodeFeature[] {
  const cached = cacheByKey.get(key);
  if (cached !== undefined) return cached;
  const initial = loadFromStorage(key);
  cacheByKey.set(key, initial);
  return initial;
}

function notify(key: string): void {
  const subs = subscribersByKey.get(key);
  if (subs === undefined) return;
  for (const sub of subs) sub();
}

function subscribeForKey(key: string, listener: Listener): () => void {
  let set = subscribersByKey.get(key);
  if (set === undefined) {
    set = new Set();
    subscribersByKey.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/**
 * Test-only: drop the module-level cache + subscribers. Production code never
 * needs to call this — the cache is rebuilt lazily from localStorage on next
 * read. Vitest suites should call this in `beforeEach` so per-test isolation
 * survives the cross-instance shared store.
 */
export function __resetRecentLocationsCacheForTests(): void {
  cacheByKey.clear();
  subscribersByKey.clear();
}

function pushFor(key: string, feature: GeocodeFeature): void {
  const current = cacheByKey.get(key) ?? loadFromStorage(key);
  const next = [
    feature,
    ...current.filter((entry) => entry.lat !== feature.lat || entry.lon !== feature.lon),
  ].slice(0, MAX_RECENTS);
  cacheByKey.set(key, next);
  saveToStorage(key, next);
  notify(key);
}

const EMPTY_RECENTS: readonly GeocodeFeature[] = Object.freeze([]);

function getServerSnapshot(): readonly GeocodeFeature[] {
  return EMPTY_RECENTS;
}

export interface UseRecentLocationsResult {
  readonly recents: readonly GeocodeFeature[];
  readonly pushRecent: (feature: GeocodeFeature) => void;
}

export function useRecentLocations(): UseRecentLocationsResult {
  const { user } = useUser();
  const userId = user?.id;
  const storageKey = buildStorageKey(userId);

  const recents = useSyncExternalStore(
    (listener) => subscribeForKey(storageKey, listener),
    () => readSnapshot(storageKey),
    getServerSnapshot,
  );

  const pushRecent = useCallback(
    (feature: GeocodeFeature) => {
      pushFor(storageKey, feature);
    },
    [storageKey],
  );

  return { recents, pushRecent };
}
