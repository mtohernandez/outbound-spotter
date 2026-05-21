import { useSyncExternalStore } from "react";

// Module-scoped subscribable so the TripDetailPanel (mounted as a route-handle
// Secondary by the app shell) can sync with the TripMap (mounted as the route
// element) without prop drilling or a shared context. Only one trip-detail
// view is rendered at a time; the singleton is safe.
const listeners = new Set<(id: string | null) => void>();
let current: string | null = null;

function get(): string | null {
  return current;
}

function getServerSnapshot(): string | null {
  return null;
}

function subscribe(fn: (id: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setHoveredStop(id: string | null): void {
  if (current === id) return;
  current = id;
  for (const fn of listeners) fn(id);
}

export function useHoveredStopId(): string | null {
  return useSyncExternalStore(subscribe, get, getServerSnapshot);
}
