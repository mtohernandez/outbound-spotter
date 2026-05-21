import { useSyncExternalStore } from "react";

import type { ResolvedAddress } from "@/features/trip-planner/schemas/trip-input";

export interface TripDraft {
  readonly current: ResolvedAddress;
  readonly pickup: ResolvedAddress;
  readonly dropoff: ResolvedAddress;
}

const EMPTY_DRAFT: TripDraft = {
  current: { label: "", lat: 0, lon: 0, confidence: null },
  pickup: { label: "", lat: 0, lon: 0, confidence: null },
  dropoff: { label: "", lat: 0, lon: 0, confidence: null },
};

const listeners = new Set<(draft: TripDraft) => void>();
let current: TripDraft = EMPTY_DRAFT;

function get(): TripDraft {
  return current;
}

function getServerSnapshot(): TripDraft {
  return EMPTY_DRAFT;
}

function subscribe(fn: (draft: TripDraft) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function shallowEqualAddress(a: ResolvedAddress, b: ResolvedAddress): boolean {
  return a.label === b.label && a.lat === b.lat && a.lon === b.lon;
}

export function setTripDraft(next: TripDraft): void {
  if (
    shallowEqualAddress(current.current, next.current) &&
    shallowEqualAddress(current.pickup, next.pickup) &&
    shallowEqualAddress(current.dropoff, next.dropoff)
  ) {
    return;
  }
  current = next;
  for (const fn of listeners) fn(next);
}

export function clearTripDraft(): void {
  setTripDraft(EMPTY_DRAFT);
}

export function useTripDraft(): TripDraft {
  return useSyncExternalStore(subscribe, get, getServerSnapshot);
}

export function isResolved(address: ResolvedAddress): boolean {
  return address.label.length > 0 && (address.lat !== 0 || address.lon !== 0);
}
